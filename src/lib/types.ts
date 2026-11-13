/**
 * Core TypeScript definitions for Strovyn Painting Co.
 */

export interface NavigationItem {
  label: string;
  href: string;
  description?: string;
  children?: NavigationItem[];
  isExternal?: boolean;
}

export interface ProjectImage {
  id: string;
  url: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
  isCover?: boolean;
  aspectRatio?: '1:1' | '4:3' | '16:9' | '3:2' | '2:3' | string;
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  client?: string;
  location: string;
  yearCompleted: number | string;
  category: string;
  scope: string[];
  description: string;
  coverImage: ProjectImage;
  gallery: ProjectImage[];
  featured?: boolean;
  finishesUsed?: string[];
  duration?: string;
}

export interface ServiceProcessStep {
  stepNumber: number;
  title: string;
  description: string;
}

export interface Service {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  category: string;
  features: string[];
  processSteps?: ServiceProcessStep[];
  heroImage: string;
  galleryImages?: string[];
  featured?: boolean;
}

export interface ArticleAuthor {
  name: string;
  role?: string;
  avatarUrl?: string;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: string;
  tags: string[];
  author: ArticleAuthor;
  publishedAt: string;
  updatedAt?: string;
  readTimeMinutes: number;
  featured?: boolean;
}

export interface Testimonial {
  id: string;
  author: string;
  role?: string;
  company?: string;
  location?: string;
  quote: string;
  rating?: number;
  projectName?: string;
  projectSlug?: string;
  date?: string;
}

export type EmploymentType = 'Full-time' | 'Part-time' | 'Contract' | 'Apprenticeship';

export interface JobOpening {
  id: string;
  slug: string;
  title: string;
  department: string;
  location: string;
  employmentType: EmploymentType;
  summary: string;
  responsibilities: string[];
  requirements: string[];
  benefits?: string[];
  isOpen: boolean;
  postedAt: string;
}

export interface JobApplication {
  id?: string;
  jobId: string;
  jobTitle: string;
  fullName: string;
  email: string;
  phone: string;
  resumeUrl?: string;
  portfolioUrl?: string;
  coverLetter?: string;
  yearsOfExperience: number | string;
  submittedAt?: string;
}

export type PropertyType = 'residential' | 'commercial' | 'historic' | 'other';
export type ContactMethod = 'email' | 'phone' | 'text';
export type QuoteStatus = 'pending' | 'reviewed' | 'quoted' | 'closed';

export interface QuoteRequest {
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  preferredContactMethod?: ContactMethod;
  propertyType: PropertyType;
  serviceCategories: string[];
  projectAddress?: string;
  estimatedSquareFootage?: number | string;
  timeframe?: string;
  budgetRange?: string;
  projectDescription: string;
  attachments?: string[];
  submittedAt?: string;
  status?: QuoteStatus;
}

export type FeedbackType = 'general' | 'praise' | 'service-issue' | 'suggestion';

export interface CustomerFeedback {
  id?: string;
  customerName: string;
  email: string;
  projectId?: string;
  rating: number; // 1 to 5
  feedbackType: FeedbackType;
  message: string;
  permissionToPublish: boolean;
  submittedAt?: string;
}

export interface CompanyAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface CompanySettings {
  name: string;
  tagline: string;
  description: string;
  contact: {
    email: string;
    phone: string;
    address: CompanyAddress;
  };
  businessHours: string;
  licenseNumber?: string;
  serviceArea?: string;
  socialMedia: {
    instagram?: string;
    linkedin?: string;
    pinterest?: string;
    facebook?: string;
    [key: string]: string | undefined;
  };
  meta: {
    title: string;
    description: string;
    ogImage?: string;
  };
}
