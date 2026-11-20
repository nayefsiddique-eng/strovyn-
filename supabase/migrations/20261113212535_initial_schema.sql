-- Initial PostgreSQL Schema for Strovyn Painting Co.

-- 1. Profiles & Administrators
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Company Settings
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'Strovyn Painting Co.',
  logo_url TEXT,
  phone TEXT DEFAULT '+61 3 9000 0000',
  whatsapp TEXT DEFAULT '+61 400 000 000',
  email TEXT DEFAULT 'studio@strovynpainting.com',
  address TEXT DEFAULT 'Melbourne & Sydney, Australia',
  description TEXT,
  social_links JSONB DEFAULT '{"instagram": "https://instagram.com/strovyn", "linkedin": "https://linkedin.com/company/strovyn"}'::jsonb,
  ai_context JSONB DEFAULT '{"services": ["Interior Painting", "Exterior Restoration", "Fine Cabinetry", "Venetian Plaster", "Heritage Conservation", "Commercial Finishes"]}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Services
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  short_description TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  key_points JSONB DEFAULT '[]'::jsonb,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Projects & Portfolio
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT NOT NULL,
  short_description TEXT,
  main_image_url TEXT,
  status TEXT DEFAULT 'Completed', -- 'Completed', 'Active On-Site', 'Handover Phase'
  project_date DATE,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Project Images (including Before/After pairs)
CREATE TABLE IF NOT EXISTS project_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  is_before BOOLEAN DEFAULT FALSE,
  is_after BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0
);

-- 6. Articles & Insights
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  featured_image_url TEXT,
  category TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- 'draft', 'published'
  reading_time INT DEFAULT 5,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Testimonials & Client Reviews
CREATE TABLE IF NOT EXISTS testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  content TEXT NOT NULL,
  project_reference TEXT,
  rating INT DEFAULT 5,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Job Openings
CREATE TABLE IF NOT EXISTS job_openings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT,
  location TEXT DEFAULT 'Melbourne & Sydney',
  employment_type TEXT DEFAULT 'Full-time',
  status TEXT DEFAULT 'active', -- 'active', 'closed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Job Applications
CREATE TABLE IF NOT EXISTS job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_opening_id UUID REFERENCES job_openings(id) ON DELETE SET NULL,
  applicant_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  cover_letter TEXT,
  cv_url TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'reviewing', 'interviewed', 'rejected', 'hired'
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Quote Requests
CREATE TABLE IF NOT EXISTS quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  project_location TEXT,
  service_required TEXT NOT NULL,
  description TEXT NOT NULL,
  preferred_contact TEXT DEFAULT 'email',
  attachment_url TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'reviewed', 'quoted', 'closed'
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Customer Feedback
CREATE TABLE IF NOT EXISTS customer_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  project_reference TEXT,
  rating INT DEFAULT 5,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS) Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_feedback ENABLE ROW LEVEL SECURITY;

-- Public Read Policies
CREATE POLICY "Public services read" ON services FOR SELECT USING (is_active = true);
CREATE POLICY "Public projects read" ON projects FOR SELECT USING (true);
CREATE POLICY "Public project images read" ON project_images FOR SELECT USING (true);
CREATE POLICY "Public articles read" ON articles FOR SELECT USING (status = 'published');
CREATE POLICY "Public testimonials read" ON testimonials FOR SELECT USING (status = 'approved');
CREATE POLICY "Public job openings read" ON job_openings FOR SELECT USING (status = 'active');
CREATE POLICY "Public company settings read" ON company_settings FOR SELECT USING (true);

-- Public Insert Policies for Submissions
CREATE POLICY "Public quote requests insert" ON quote_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Public applications insert" ON job_applications FOR INSERT WITH CHECK (true);
CREATE POLICY "Public feedback insert" ON customer_feedback FOR INSERT WITH CHECK (true);
