-- ===== Enums =====
CREATE TYPE public.app_role AS ENUM ('student', 'staff', 'admin');
CREATE TYPE public.complaint_status AS ENUM ('submitted', 'assigned', 'in_progress', 'needs_info', 'resolved', 'rejected', 'reopened');
CREATE TYPE public.update_kind AS ENUM ('created', 'comment', 'status_change', 'assignment', 'edit');

-- ===== Profiles =====
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '' CHECK (char_length(full_name) <= 100),
  email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name, updated_at) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ===== Roles (separate table, one role per user) =====
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'student',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
$$;

CREATE POLICY "Users read own profile; staff/admin read all; anyone reads staff/admin profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'staff')
  OR public.has_role(id, 'staff')
  OR public.has_role(id, 'admin')
);
CREATE POLICY "Users update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Users read own role; admins read all"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- New users always start as students; metadata can never grant a role.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    left(coalesce(nullif(trim(NEW.raw_user_meta_data->>'full_name'), ''), nullif(trim(NEW.raw_user_meta_data->>'name'), ''), split_part(NEW.email, '@', 1), ''), 100),
    coalesce(NEW.email, '')
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== Categories =====
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 60),
  description text CHECK (description IS NULL OR char_length(description) <= 200),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX categories_name_lower_idx ON public.categories (lower(name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users read categories" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update categories" ON public.categories FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete categories" ON public.categories FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.categories (name, description) VALUES
  ('Classroom', 'Furniture, projectors, boards and room conditions'),
  ('Wi-Fi/IT', 'Network, computers, printers and campus systems'),
  ('Electrical', 'Lights, sockets, power outages and wiring'),
  ('Plumbing', 'Leaks, washrooms, drinking water and drainage'),
  ('Cleanliness', 'Waste, hygiene, pests and housekeeping'),
  ('Other', 'Anything that does not fit another category');

-- ===== Complaints =====
CREATE SEQUENCE public.complaint_tracking_seq START 1001;

CREATE TABLE public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_number text NOT NULL UNIQUE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 5 AND 120),
  description text NOT NULL CHECK (char_length(trim(description)) BETWEEN 10 AND 4000),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  location text NOT NULL CHECK (char_length(trim(location)) BETWEEN 2 AND 120),
  room_number text CHECK (room_number IS NULL OR char_length(room_number) <= 30),
  image_path text CHECK (image_path IS NULL OR char_length(image_path) <= 300),
  status public.complaint_status NOT NULL DEFAULT 'submitted',
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX complaints_student_created_idx ON public.complaints (student_id, created_at DESC);
CREATE INDEX complaints_assigned_status_idx ON public.complaints (assigned_to, status);
CREATE INDEX complaints_status_idx ON public.complaints (status);
CREATE INDEX complaints_category_idx ON public.complaints (category_id);
CREATE INDEX complaints_created_idx ON public.complaints (created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.complaints TO authenticated;
GRANT ALL ON public.complaints TO service_role;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner, assigned staff and admins read complaints"
ON public.complaints FOR SELECT TO authenticated
USING (student_id = auth.uid() OR assigned_to = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Students submit their own complaints"
ON public.complaints FOR INSERT TO authenticated
WITH CHECK (student_id = auth.uid() AND public.has_role(auth.uid(), 'student'));
CREATE POLICY "Admins delete complaints"
ON public.complaints FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ===== Complaint updates (audit history) =====
CREATE TABLE public.complaint_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  author_role public.app_role NOT NULL,
  kind public.update_kind NOT NULL,
  body text CHECK (body IS NULL OR char_length(body) <= 2000),
  from_status public.complaint_status,
  to_status public.complaint_status,
  assigned_to_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX complaint_updates_complaint_created_idx ON public.complaint_updates (complaint_id, created_at);
GRANT SELECT ON public.complaint_updates TO authenticated;
GRANT ALL ON public.complaint_updates TO service_role;
ALTER TABLE public.complaint_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read history of complaints you can see"
ON public.complaint_updates FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id));

-- Internal helper: write a history row as the current user
CREATE OR REPLACE FUNCTION public._log_complaint_update(
  _complaint_id uuid, _kind public.update_kind, _body text,
  _from public.complaint_status, _to public.complaint_status, _assigned_name text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _name text;
  _role public.app_role;
BEGIN
  SELECT coalesce(nullif(p.full_name, ''), 'User') INTO _name FROM public.profiles p WHERE p.id = auth.uid();
  _role := coalesce(public.get_user_role(auth.uid()), 'student');
  INSERT INTO public.complaint_updates (complaint_id, author_id, author_name, author_role, kind, body, from_status, to_status, assigned_to_name)
  VALUES (_complaint_id, auth.uid(), coalesce(_name, 'User'), _role, _kind, _body, _from, _to, _assigned_name);
END;
$$;
REVOKE EXECUTE ON FUNCTION public._log_complaint_update(uuid, public.update_kind, text, public.complaint_status, public.complaint_status, text) FROM PUBLIC, anon, authenticated;

-- Before insert: server owns tracking number, status and assignment
CREATE OR REPLACE FUNCTION public.complaints_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE id = NEW.category_id AND is_active) THEN
    RAISE EXCEPTION 'Please choose an active category' USING ERRCODE = '22023';
  END IF;
  IF NEW.image_path IS NOT NULL AND NEW.image_path NOT LIKE (NEW.student_id::text || '/%') THEN
    RAISE EXCEPTION 'Invalid image attachment' USING ERRCODE = '22023';
  END IF;
  NEW.tracking_number := 'CCT-' || to_char(now() AT TIME ZONE 'utc', 'YY') || '-' || lpad(nextval('public.complaint_tracking_seq')::text, 5, '0');
  NEW.title := trim(NEW.title);
  NEW.description := trim(NEW.description);
  NEW.location := trim(NEW.location);
  NEW.room_number := nullif(trim(coalesce(NEW.room_number, '')), '');
  NEW.status := 'submitted';
  NEW.assigned_to := NULL;
  NEW.resolved_at := NULL;
  NEW.created_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER complaints_before_insert_trg BEFORE INSERT ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.complaints_before_insert();

CREATE OR REPLACE FUNCTION public.complaints_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._log_complaint_update(NEW.id, 'created', NULL, NULL, 'submitted', NULL);
  RETURN NEW;
END;
$$;
CREATE TRIGGER complaints_after_insert_trg AFTER INSERT ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.complaints_after_insert();

-- ===== Workflow functions (all permission checks live here) =====
CREATE OR REPLACE FUNCTION public.change_complaint_status(_complaint_id uuid, _status public.complaint_status, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.complaints%ROWTYPE;
  _uid uuid := auth.uid();
  _role public.app_role;
  _note_clean text := nullif(trim(coalesce(_note, '')), '');
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'You must be signed in' USING ERRCODE = '42501'; END IF;
  SELECT * INTO c FROM public.complaints WHERE id = _complaint_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Complaint not found' USING ERRCODE = 'P0002'; END IF;
  _role := public.get_user_role(_uid);

  IF _note_clean IS NOT NULL AND char_length(_note_clean) > 2000 THEN
    RAISE EXCEPTION 'Notes must be 2000 characters or fewer' USING ERRCODE = '22023';
  END IF;
  IF c.status = _status THEN
    RAISE EXCEPTION 'The complaint already has this status' USING ERRCODE = '22023';
  END IF;

  IF _role = 'admin' THEN
    IF _status = 'assigned' AND c.assigned_to IS NULL THEN
      RAISE EXCEPTION 'Assign a staff member first' USING ERRCODE = '22023';
    END IF;
  ELSIF _role = 'staff' AND c.assigned_to = _uid THEN
    IF _status NOT IN ('in_progress', 'needs_info', 'resolved', 'rejected')
       OR c.status NOT IN ('assigned', 'in_progress', 'needs_info', 'reopened') THEN
      RAISE EXCEPTION 'This status change is not allowed' USING ERRCODE = '42501';
    END IF;
  ELSIF c.student_id = _uid THEN
    IF NOT (_status = 'reopened' AND c.status = 'resolved') THEN
      RAISE EXCEPTION 'You can only reopen a resolved complaint' USING ERRCODE = '42501';
    END IF;
    IF _note_clean IS NULL THEN
      RAISE EXCEPTION 'Please explain why the issue is not resolved' USING ERRCODE = '22023';
    END IF;
  ELSE
    RAISE EXCEPTION 'You do not have permission to update this complaint' USING ERRCODE = '42501';
  END IF;

  IF _status IN ('rejected', 'needs_info') AND _note_clean IS NULL THEN
    RAISE EXCEPTION 'Please add a note for the student' USING ERRCODE = '22023';
  END IF;

  UPDATE public.complaints SET
    status = _status,
    updated_at = now(),
    resolved_at = CASE WHEN _status = 'resolved' THEN now() WHEN _status = 'reopened' THEN NULL ELSE resolved_at END
  WHERE id = _complaint_id;

  PERFORM public._log_complaint_update(_complaint_id, 'status_change', _note_clean, c.status, _status, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_complaint(_complaint_id uuid, _staff_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.complaints%ROWTYPE;
  _staff_name text;
  _new_status public.complaint_status;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can assign complaints' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO c FROM public.complaints WHERE id = _complaint_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Complaint not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.has_role(_staff_id, 'staff') THEN
    RAISE EXCEPTION 'Complaints can only be assigned to staff members' USING ERRCODE = '22023';
  END IF;
  IF c.assigned_to = _staff_id THEN
    RAISE EXCEPTION 'The complaint is already assigned to this staff member' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(nullif(full_name, ''), email) INTO _staff_name FROM public.profiles WHERE id = _staff_id;
  _new_status := CASE WHEN c.status IN ('submitted', 'reopened') THEN 'assigned'::public.complaint_status ELSE c.status END;

  UPDATE public.complaints SET assigned_to = _staff_id, status = _new_status, updated_at = now() WHERE id = _complaint_id;

  PERFORM public._log_complaint_update(
    _complaint_id, 'assignment',
    CASE WHEN c.assigned_to IS NULL THEN NULL ELSE 'Reassigned' END,
    CASE WHEN _new_status <> c.status THEN c.status ELSE NULL END,
    CASE WHEN _new_status <> c.status THEN _new_status ELSE NULL END,
    _staff_name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.add_complaint_comment(_complaint_id uuid, _body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.complaints%ROWTYPE;
  _uid uuid := auth.uid();
  _clean text := trim(coalesce(_body, ''));
  _next public.complaint_status;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'You must be signed in' USING ERRCODE = '42501'; END IF;
  SELECT * INTO c FROM public.complaints WHERE id = _complaint_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Complaint not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT (c.student_id = _uid
          OR (c.assigned_to = _uid AND public.has_role(_uid, 'staff'))
          OR public.has_role(_uid, 'admin')) THEN
    RAISE EXCEPTION 'You do not have permission to comment on this complaint' USING ERRCODE = '42501';
  END IF;
  IF char_length(_clean) < 1 OR char_length(_clean) > 2000 THEN
    RAISE EXCEPTION 'Comments must be between 1 and 2000 characters' USING ERRCODE = '22023';
  END IF;

  PERFORM public._log_complaint_update(_complaint_id, 'comment', _clean, NULL, NULL, NULL);

  IF c.student_id = _uid AND c.status = 'needs_info' THEN
    _next := CASE WHEN c.assigned_to IS NULL THEN 'submitted'::public.complaint_status ELSE 'in_progress'::public.complaint_status END;
    UPDATE public.complaints SET status = _next, updated_at = now() WHERE id = _complaint_id;
    PERFORM public._log_complaint_update(_complaint_id, 'status_change', 'Student provided the requested information', c.status, _next, NULL);
  ELSE
    UPDATE public.complaints SET updated_at = now() WHERE id = _complaint_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.edit_complaint(
  _complaint_id uuid, _title text, _description text, _category_id uuid, _location text, _room_number text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.complaints%ROWTYPE;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'You must be signed in' USING ERRCODE = '42501'; END IF;
  SELECT * INTO c FROM public.complaints WHERE id = _complaint_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Complaint not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT ((c.student_id = _uid AND c.status = 'submitted') OR public.has_role(_uid, 'admin')) THEN
    RAISE EXCEPTION 'Details can only be edited before the complaint is assigned' USING ERRCODE = '42501';
  END IF;
  IF char_length(trim(coalesce(_title, ''))) NOT BETWEEN 5 AND 120 THEN
    RAISE EXCEPTION 'Title must be 5 to 120 characters' USING ERRCODE = '22023'; END IF;
  IF char_length(trim(coalesce(_description, ''))) NOT BETWEEN 10 AND 4000 THEN
    RAISE EXCEPTION 'Description must be 10 to 4000 characters' USING ERRCODE = '22023'; END IF;
  IF char_length(trim(coalesce(_location, ''))) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Location must be 2 to 120 characters' USING ERRCODE = '22023'; END IF;
  IF char_length(coalesce(_room_number, '')) > 30 THEN
    RAISE EXCEPTION 'Room number must be 30 characters or fewer' USING ERRCODE = '22023'; END IF;
  IF _category_id <> c.category_id AND NOT EXISTS (SELECT 1 FROM public.categories WHERE id = _category_id AND is_active) THEN
    RAISE EXCEPTION 'Please choose an active category' USING ERRCODE = '22023'; END IF;

  UPDATE public.complaints SET
    title = trim(_title), description = trim(_description), category_id = _category_id,
    location = trim(_location), room_number = nullif(trim(coalesce(_room_number, '')), ''),
    updated_at = now()
  WHERE id = _complaint_id;

  PERFORM public._log_complaint_update(_complaint_id, 'edit', 'Complaint details were updated', NULL, NULL, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_role(_user_id uuid, _role public.app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can change roles' USING ERRCODE = '42501';
  END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own role' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (id uuid, full_name text, email text, role public.app_role, created_at timestamptz, open_assigned bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can list users' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, p.email, coalesce(r.role, 'student'::public.app_role), p.created_at,
    (SELECT count(*) FROM public.complaints c WHERE c.assigned_to = p.id AND c.status NOT IN ('resolved', 'rejected'))
  FROM public.profiles p
  LEFT JOIN public.user_roles r ON r.user_id = p.id
  ORDER BY p.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can view statistics' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM public.complaints),
    'unassigned', (SELECT count(*) FROM public.complaints WHERE assigned_to IS NULL AND status NOT IN ('resolved', 'rejected')),
    'last_7_days', (SELECT count(*) FROM public.complaints WHERE created_at > now() - interval '7 days'),
    'by_status', coalesce((SELECT jsonb_object_agg(status, n) FROM (SELECT status, count(*) n FROM public.complaints GROUP BY status) s), '{}'::jsonb),
    'by_category', coalesce((SELECT jsonb_agg(jsonb_build_object('name', cat.name, 'count', coalesce(x.n, 0)) ORDER BY coalesce(x.n, 0) DESC, cat.name)
      FROM public.categories cat
      LEFT JOIN (SELECT category_id, count(*) n FROM public.complaints GROUP BY category_id) x ON x.category_id = cat.id), '[]'::jsonb)
  ) INTO _result;
  RETURN _result;
END;
$$;

-- Lock down function execution to signed-in users
REVOKE EXECUTE ON FUNCTION public.change_complaint_status(uuid, public.complaint_status, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assign_complaint(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_complaint_comment(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.edit_complaint(uuid, text, text, uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.change_complaint_status(uuid, public.complaint_status, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_complaint(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_complaint_comment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edit_complaint(uuid, text, text, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;

-- ===== Storage policies for complaint photos (bucket created separately) =====
CREATE POLICY "Students upload complaint photos to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'complaint-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
);
CREATE POLICY "View complaint photos you can access"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'complaint-images'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.complaints c WHERE c.image_path = objects.name)
  )
);
CREATE POLICY "Delete own complaint photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'complaint-images' AND (storage.foldername(name))[1] = auth.uid()::text);
