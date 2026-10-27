-- ============================================================================
-- NECL Phase 9 Migration: Real-Time Tracking, Waypoint Events &
-- Geofencing Milestones Workflow
--
-- Features:
--  1. Create public.trip_location_logs (GPS telemetry stream with speed, heading, accuracy)
--  2. Create public.trip_waypoint_events (Geofence breaches & operational milestones)
--  3. Add telemetry columns to public.trips (last position, speed, heading, ETA, geofence coords)
--  4. Stored Procedure: rpc_ingest_trip_location_ping (Telemetry ingestion, position caching,
--     Haversine geofence calculation, and automatic milestone transitions)
--  5. Stored Procedure: rpc_update_trip_milestone (Strict state machine sequence validation,
--     booking synchronization, and immutable audit logging)
-- ============================================================================

-- 1. Create trip_location_logs table
CREATE TABLE IF NOT EXISTS public.trip_location_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  speed NUMERIC(6, 2) DEFAULT 0,
  heading NUMERIC(5, 2) DEFAULT 0,
  accuracy NUMERIC(8, 2),
  altitude NUMERIC(8, 2),
  battery_level NUMERIC(4, 2),
  is_mock BOOLEAN DEFAULT false,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_location_logs_trip_time
  ON public.trip_location_logs (trip_id, recorded_at DESC);

-- 2. Create trip_waypoint_events table
CREATE TABLE IF NOT EXISTS public.trip_waypoint_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  location_latitude NUMERIC(10, 7),
  location_longitude NUMERIC(10, 7),
  distance_to_target_km NUMERIC(8, 3),
  geofence_radius_km NUMERIC(6, 3) DEFAULT 1.0,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_waypoint_events_trip_time
  ON public.trip_waypoint_events (trip_id, triggered_at DESC);

-- 3. Add telemetry columns to public.trips
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS last_latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS last_longitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS last_speed NUMERIC(6, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_heading NUMERIC(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_ping_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pickup_latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS pickup_longitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS destination_latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS destination_longitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS total_distance_km NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS distance_remaining_km NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS estimated_arrival_at TIMESTAMPTZ;

-- 4. Haversine Distance Helper Function (Returns distance in Kilometers)
CREATE OR REPLACE FUNCTION public.necl_haversine_distance(
  lat1 NUMERIC,
  lon1 NUMERIC,
  lat2 NUMERIC,
  lon2 NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  r CONSTANT NUMERIC := 6371.0; -- Earth mean radius in km
  dlat NUMERIC;
  dlon NUMERIC;
  a NUMERIC;
  c NUMERIC;
BEGIN
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN NULL;
  END IF;

  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);

  a := sin(dlat / 2.0)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2.0)^2;
  c := 2.0 * atan2(sqrt(a), sqrt(1.0 - a));

  RETURN round((r * c)::NUMERIC, 3);
END;
$$;

-- 5. Stored Procedure: rpc_ingest_trip_location_ping
CREATE OR REPLACE FUNCTION public.rpc_ingest_trip_location_ping(
  p_trip_id UUID,
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_speed NUMERIC DEFAULT 0,
  p_heading NUMERIC DEFAULT 0,
  p_accuracy NUMERIC DEFAULT NULL,
  p_battery_level NUMERIC DEFAULT NULL,
  p_recorded_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trip RECORD;
  v_now TIMESTAMPTZ := COALESCE(p_recorded_at, NOW());
  v_dist_to_pickup NUMERIC;
  v_dist_to_dest NUMERIC;
  v_next_status TEXT;
  v_geofence_triggered TEXT := NULL;
  v_geofence_radius CONSTANT NUMERIC := 1.0; -- 1.0 km radius
BEGIN
  -- 1. Coordinate Range Validation
  IF p_latitude < -90 OR p_latitude > 90 OR p_longitude < -180 OR p_longitude > 180 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_COORDINATES',
      'error', 'Latitude must be between -90 and 90, Longitude between -180 and 180.'
    );
  END IF;

  -- 2. Fetch Trip
  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'TRIP_NOT_FOUND',
      'error', 'Trip not found.'
    );
  END IF;

  -- 3. Calculate Geofence Distances if target coordinates exist
  IF v_trip.pickup_latitude IS NOT NULL AND v_trip.pickup_longitude IS NOT NULL THEN
    v_dist_to_pickup := public.necl_haversine_distance(p_latitude, p_longitude, v_trip.pickup_latitude, v_trip.pickup_longitude);
  END IF;

  IF v_trip.destination_latitude IS NOT NULL AND v_trip.destination_longitude IS NOT NULL THEN
    v_dist_to_dest := public.necl_haversine_distance(p_latitude, p_longitude, v_trip.destination_latitude, v_trip.destination_longitude);
  END IF;

  v_next_status := v_trip.trip_status;

  -- 4. Geofencing Evaluation
  -- Arrival at Origin Loading Hub:
  IF v_trip.trip_status = 'DISPATCHED' AND v_dist_to_pickup IS NOT NULL AND v_dist_to_pickup <= v_geofence_radius THEN
    v_next_status := 'AT_LOADING';
    v_geofence_triggered := 'GEOFENCE_ENTER_PICKUP';

    INSERT INTO public.trip_waypoint_events (
      trip_id,
      event_type,
      location_latitude,
      location_longitude,
      distance_to_target_km,
      geofence_radius_km,
      notes,
      triggered_at
    ) VALUES (
      p_trip_id,
      'GEOFENCE_ENTER_PICKUP',
      p_latitude,
      p_longitude,
      v_dist_to_pickup,
      v_geofence_radius,
      'Vehicle arrived inside pickup geofence (within ' || v_dist_to_pickup || ' km). Trip status transitioned to AT_LOADING.',
      v_now
    );
  -- Arrival at Destination Unloading Hub:
  ELSIF v_trip.trip_status = 'IN_TRANSIT' AND v_dist_to_dest IS NOT NULL AND v_dist_to_dest <= v_geofence_radius THEN
    v_next_status := 'AT_UNLOADING';
    v_geofence_triggered := 'GEOFENCE_ENTER_DESTINATION';

    INSERT INTO public.trip_waypoint_events (
      trip_id,
      event_type,
      location_latitude,
      location_longitude,
      distance_to_target_km,
      geofence_radius_km,
      notes,
      triggered_at
    ) VALUES (
      p_trip_id,
      'GEOFENCE_ENTER_DESTINATION',
      p_latitude,
      p_longitude,
      v_dist_to_dest,
      v_geofence_radius,
      'Vehicle arrived inside delivery geofence (within ' || v_dist_to_dest || ' km). Trip status transitioned to AT_UNLOADING.',
      v_now
    );
  END IF;

  -- 5. Record Ping into trip_location_logs
  INSERT INTO public.trip_location_logs (
    trip_id,
    latitude,
    longitude,
    speed,
    heading,
    accuracy,
    battery_level,
    recorded_at,
    created_at
  ) VALUES (
    p_trip_id,
    p_latitude,
    p_longitude,
    COALESCE(p_speed, 0),
    COALESCE(p_heading, 0),
    p_accuracy,
    p_battery_level,
    v_now,
    v_now
  );

  -- 6. Update Trips table telemetry cache
  UPDATE public.trips
  SET
    last_latitude = p_latitude,
    last_longitude = p_longitude,
    last_speed = COALESCE(p_speed, 0),
    last_heading = COALESCE(p_heading, 0),
    last_ping_at = v_now,
    trip_status = v_next_status,
    distance_remaining_km = COALESCE(v_dist_to_dest, distance_remaining_km)
  WHERE id = p_trip_id;

  RETURN jsonb_build_object(
    'success', true,
    'tripId', p_trip_id,
    'latitude', p_latitude,
    'longitude', p_longitude,
    'speed', p_speed,
    'heading', p_heading,
    'recordedAt', v_now,
    'tripStatus', v_next_status,
    'distanceToPickupKm', v_dist_to_pickup,
    'distanceToDestinationKm', v_dist_to_dest,
    'geofenceTriggered', v_geofence_triggered,
    'message', 'Location ping ingested successfully.'
  );
END;
$$;

-- 6. Stored Procedure: rpc_update_trip_milestone
CREATE OR REPLACE FUNCTION public.rpc_update_trip_milestone(
  p_trip_id UUID,
  p_new_status TEXT,
  p_notes TEXT DEFAULT NULL,
  p_updated_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trip RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_is_valid_transition BOOLEAN := false;
BEGIN
  -- 1. Fetch Trip
  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'TRIP_NOT_FOUND',
      'error', 'Trip not found.'
    );
  END IF;

  -- 2. State Machine Transition Guard:
  -- Allowed progression:
  -- CREATED -> LORRY_ASSIGNED -> DISPATCHED -> AT_LOADING -> IN_TRANSIT -> AT_UNLOADING -> DELIVERED -> COMPLETED
  IF v_trip.trip_status = p_new_status THEN
    v_is_valid_transition := true; -- Idempotent update
  ELSIF v_trip.trip_status IN ('CREATED', 'LORRY_ASSIGNED') AND p_new_status IN ('LORRY_ASSIGNED', 'DISPATCHED', 'AT_LOADING') THEN
    v_is_valid_transition := true;
  ELSIF v_trip.trip_status = 'DISPATCHED' AND p_new_status IN ('AT_LOADING', 'IN_TRANSIT') THEN
    v_is_valid_transition := true;
  ELSIF v_trip.trip_status = 'AT_LOADING' AND p_new_status IN ('IN_TRANSIT') THEN
    v_is_valid_transition := true;
  ELSIF v_trip.trip_status = 'IN_TRANSIT' AND p_new_status IN ('AT_UNLOADING', 'DELIVERED') THEN
    v_is_valid_transition := true;
  ELSIF v_trip.trip_status = 'AT_UNLOADING' AND p_new_status IN ('DELIVERED', 'COMPLETED') THEN
    v_is_valid_transition := true;
  ELSIF v_trip.trip_status = 'DELIVERED' AND p_new_status = 'COMPLETED' THEN
    v_is_valid_transition := true;
  END IF;

  IF NOT v_is_valid_transition THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_MILESTONE_TRANSITION',
      'error', 'Cannot transition trip status from ' || v_trip.trip_status || ' to ' || p_new_status || '. Sequence violation.'
    );
  END IF;

  -- 3. Perform Status Updates on Trip
  UPDATE public.trips
  SET
    trip_status = p_new_status,
    started_at = CASE WHEN p_new_status = 'IN_TRANSIT' AND started_at IS NULL THEN v_now ELSE started_at END,
    completed_at = CASE WHEN p_new_status = 'COMPLETED' THEN v_now ELSE completed_at END
  WHERE id = p_trip_id;

  -- 4. Synchronize Booking Status
  IF v_trip.booking_id IS NOT NULL THEN
    IF p_new_status = 'IN_TRANSIT' THEN
      UPDATE public.bookings SET booking_status = 'IN_PROGRESS' WHERE id = v_trip.booking_id;
    ELSIF p_new_status = 'DELIVERED' THEN
      UPDATE public.bookings SET booking_status = 'DELIVERED' WHERE id = v_trip.booking_id;
    ELSIF p_new_status = 'COMPLETED' THEN
      UPDATE public.bookings SET booking_status = 'COMPLETED' WHERE id = v_trip.booking_id;
    END IF;
  END IF;

  -- 5. Record Waypoint Event
  INSERT INTO public.trip_waypoint_events (
    trip_id,
    event_type,
    location_latitude,
    location_longitude,
    notes,
    triggered_at
  ) VALUES (
    p_trip_id,
    p_new_status,
    v_trip.last_latitude,
    v_trip.last_longitude,
    p_notes,
    v_now
  );

  -- 6. Audit in auth_audit_log
  BEGIN
    INSERT INTO public.auth_audit_log (
      user_id,
      user_type,
      event_type,
      details
    ) VALUES (
      COALESCE(p_updated_by, v_trip.driver_id, v_trip.vendor_id, '00000000-0000-0000-0000-000000000001'::uuid),
      'SYSTEM',
      'TRIP_MILESTONE_UPDATED',
      jsonb_build_object(
        'trip_id', p_trip_id,
        'previous_status', v_trip.trip_status,
        'new_status', p_new_status,
        'notes', p_notes,
        'updated_at', v_now
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'tripId', p_trip_id,
    'previousStatus', v_trip.trip_status,
    'newStatus', p_new_status,
    'updatedAt', v_now,
    'message', 'Trip milestone transitioned to ' || p_new_status || ' successfully.'
  );
END;
$$;
