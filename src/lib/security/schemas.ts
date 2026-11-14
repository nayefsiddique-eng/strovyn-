import { z } from 'zod';

// Quotes Schema
export const quoteRequestSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
  email: z.string().trim().email('Invalid email address').max(150),
  phone: z.string().trim().min(6, 'Valid phone number is required').max(30),
  projectLocation: z.string().trim().max(150).optional().default('Metro Adelaide, SA'),
  serviceRequired: z.string().trim().min(2).max(100),
  propertyType: z.string().trim().max(100).optional(),
  approximateAreaM2: z.number().positive().max(100000).optional(),
  storeys: z.number().int().min(1).max(50).optional(),
  isInterior: z.boolean().optional(),
  isExterior: z.boolean().optional(),
  isOccupied: z.boolean().optional(),
  targetTimeline: z.string().trim().max(100).optional(),
  budgetRange: z.string().trim().max(100).optional(),
  description: z.string().trim().min(10, 'Scope description must be at least 10 characters').max(3000),
  preferredContact: z.enum(['email', 'phone', 'whatsapp']).default('email'),
  attachmentUrl: z.string().trim().max(500).optional(),
});

// Feedback Schema
export const feedbackSchema = z.object({
  customerName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(150).optional(),
  projectReference: z.string().trim().max(150).optional(),
  rating: z.number().int().min(1).max(5),
  message: z.string().trim().min(5).max(2000),
  permissionToPublish: z.boolean().default(false),
});

// Job Application Schema
export const applicationSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(150),
  phone: z.string().trim().min(6).max(30),
  position: z.string().trim().min(2).max(100),
  yearsOfExperience: z.string().trim().max(50).optional().default('1+'),
  portfolioUrl: z.string().trim().url().max(300).optional().or(z.literal('')),
  coverLetter: z.string().trim().max(4000).optional(),
  resumeUrl: z.string().trim().max(500).optional(),
});

// AI Assistant Schema
export const aiAssistantMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().trim().min(1).max(1000),
});

export const aiAssistantSchema = z.object({
  message: z.string().trim().min(1, 'Query message cannot be empty').max(800),
  history: z.array(aiAssistantMessageSchema).max(6).optional(),
});

// Admin Auth Schema
export const adminLoginSchema = z.object({
  action: z.literal('login'),
  key: z.string().min(1, 'Admin key required').max(200),
});

export const adminLogoutSchema = z.object({
  action: z.literal('logout'),
});
