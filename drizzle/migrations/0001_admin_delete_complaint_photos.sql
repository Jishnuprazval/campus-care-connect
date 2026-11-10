CREATE POLICY "Admins delete complaint photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'complaint-images' AND public.has_role(auth.uid(), 'admin'));