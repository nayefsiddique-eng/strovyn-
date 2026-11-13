'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface ProjectItem {
  slug: string;
  title: string;
  category: string;
  location: string;
  heroImage: string;
  galleryImages: string[];
}

export default function AdminPhotosPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(true);
  const [accessKey, setAccessKey] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);

  // Management state
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);
  const [targetType, setTargetType] = useState<'hero' | 'gallery'>('hero');
  const [targetGalleryIndex, setTargetGalleryIndex] = useState<number>(0);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [uploadSuccess, setUploadSuccess] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  // Check existing session
  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      // Check if testing preview mode on localhost
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('preview') === 'workspace') {
          const res = await fetch('/api/projects');
          const data = await res.json();
          setProjects(data.projects);
          if (data.projects.length > 0) {
            setSelectedProject(data.projects[0]);
          }
          setIsAuthenticated(true);
          return;
        }
      }

      const res = await fetch('/api/admin/photos');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects);
        if (data.projects.length > 0 && !selectedProject) {
          setSelectedProject(data.projects[0]);
        }
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch {
      setIsAuthenticated(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');

    try {
      const res = await fetch('/api/admin/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', key: accessKey }),
      });

      const data = await res.json();
      if (data.success) {
        setIsAuthenticated(true);
        fetchProjects();
      } else {
        setAuthError(data.error || 'Invalid access key');
      }
    } catch {
      setAuthError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    setIsAuthenticated(false);
    setSelectedProject(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreviewFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setUploadSuccess('');
      setUploadError('');
    }
  };

  const handleUpload = async () => {
    if (!selectedProject) return;
    if (!previewFile) {
      setUploadError('Please choose an image file first');
      return;
    }

    setIsUploading(true);
    setUploadError('');
    setUploadSuccess('');

    try {
      const formData = new FormData();
      formData.append('slug', selectedProject.slug);
      formData.append('type', targetType);
      if (targetType === 'gallery') {
        formData.append('index', targetGalleryIndex.toString());
      }
      formData.append('file', previewFile);

      const res = await fetch('/api/admin/photos', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setUploadSuccess('Photograph updated successfully!');
        setPreviewFile(null);
        setPreviewUrl('');
        // Refresh project list
        await fetchProjects();
        // Update selectedProject in place
        setSelectedProject((prev) => {
          if (!prev) return null;
          if (targetType === 'hero') {
            return { ...prev, heroImage: data.newUrl };
          } else {
            const nextGallery = [...prev.galleryImages];
            nextGallery[targetGalleryIndex] = data.newUrl;
            return { ...prev, galleryImages: nextGallery };
          }
        });
      } else {
        setUploadError(data.error || 'Failed to update photograph');
      }
    } catch {
      setUploadError('Error uploading photograph');
    } finally {
      setIsUploading(false);
    }
  };

  // If not authenticated, render login form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F4F1EA] flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-white border border-[#B8B5AE]/40 p-8 shadow-xl">
          <div className="mb-6 text-center">
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#A78B65] block mb-2 font-medium">
              STROVYN PAINTING CO. &mdash; INTERNAL MEDIA
            </span>
            <h1 className="font-serif text-2xl text-[#20211F]">
              Portfolio Photo Manager
            </h1>
            <p className="text-xs text-[#20211F]/60 mt-1 font-light">
              Secure access for team photography replacements.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-wider text-[#20211F]/80 mb-1">
                Access Passphrase
              </label>
              <input
                type="password"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                placeholder="Enter administration key"
                className="w-full px-4 py-3 border border-[#B8B5AE] text-sm focus:outline-none focus:border-[#C41E1E]"
                autoFocus
              />
            </div>

            {authError && (
              <div className="text-xs text-[#C41E1E] font-medium bg-[#C41E1E]/5 p-2 border border-[#C41E1E]/20">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#20211F] text-white hover:bg-[#C41E1E] transition-colors font-mono text-xs uppercase tracking-[0.2em] font-medium disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Authenticating...' : 'Enter Photo Manager'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#B8B5AE]/30 text-center">
            <Link
              href="/"
              className="font-mono text-[10px] uppercase tracking-widest text-[#20211F]/60 hover:text-[#C41E1E]"
            >
              &larr; Return to Public Website
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated Media Manager Interface
  return (
    <div className="min-h-screen bg-[#F4F1EA] text-[#20211F] font-sans pb-24">
      {/* Top Bar */}
      <header className="bg-white border-b border-[#B8B5AE]/40 px-6 lg:px-12 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="w-2.5 h-2.5 bg-[#C41E1E] inline-block" />
          <h1 className="font-serif text-lg text-[#20211F]">
            Strovyn Portfolio Photo Replacement
          </h1>
          <span className="hidden sm:inline-block font-mono text-[10px] text-[#A78B65] uppercase tracking-widest">
            SECURE REPOSITORY
          </span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/projects"
            target="_blank"
            className="font-mono text-xs uppercase tracking-wider text-[#20211F]/70 hover:text-[#C41E1E]"
          >
            View Live Projects ↗
          </Link>
          <button
            onClick={handleLogout}
            className="font-mono text-xs uppercase tracking-wider text-[#C41E1E] hover:underline cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Project List Selector (4 Columns) */}
          <div className="lg:col-span-4 bg-white border border-[#B8B5AE]/40 p-6 shadow-sm">
            <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-[#A78B65] mb-4 font-semibold">
              Select Project to Update
            </h2>

            <div className="space-y-3">
              {projects.map((proj) => {
                const isSelected = selectedProject?.slug === proj.slug;
                return (
                  <button
                    key={proj.slug}
                    onClick={() => {
                      setSelectedProject(proj);
                      setPreviewFile(null);
                      setPreviewUrl('');
                      setUploadSuccess('');
                      setUploadError('');
                    }}
                    className={`w-full text-left p-3 border transition-all cursor-pointer flex items-center gap-3 ${
                      isSelected
                        ? 'border-[#C41E1E] bg-[#C41E1E]/5 shadow-sm'
                        : 'border-[#B8B5AE]/30 hover:border-[#20211F]/50 bg-white'
                    }`}
                  >
                    <div className="w-14 h-14 relative shrink-0 overflow-hidden bg-gray-200">
                      <Image
                        src={proj.heroImage}
                        alt={proj.title}
                        fill
                        sizes="60px"
                        className="object-cover"
                      />
                    </div>
                    <div className="overflow-hidden">
                      <div className="font-serif text-sm text-[#20211F] truncate font-medium">
                        {proj.title}
                      </div>
                      <div className="font-mono text-[10px] text-[#A78B65] uppercase tracking-wider truncate">
                        {proj.location}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Editor & Uploader (8 Columns) */}
          <div className="lg:col-span-8 bg-white border border-[#B8B5AE]/40 p-6 lg:p-8 shadow-sm">
            {selectedProject ? (
              <div>
                <div className="border-b border-[#B8B5AE]/30 pb-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[#A78B65]">
                      {selectedProject.category}
                    </span>
                    <h2 className="font-serif text-2xl text-[#20211F]">
                      {selectedProject.title}
                    </h2>
                  </div>
                  <span className="font-mono text-xs text-[#20211F]/50">
                    Slug: {selectedProject.slug}
                  </span>
                </div>

                {/* Target Type Picker */}
                <div className="mb-6">
                  <label className="block font-mono text-xs uppercase tracking-wider text-[#20211F]/80 mb-2">
                    1. Choose Slot to Replace:
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => {
                        setTargetType('hero');
                        setPreviewFile(null);
                        setPreviewUrl('');
                      }}
                      className={`px-4 py-2 text-xs font-mono uppercase tracking-wider border cursor-pointer ${
                        targetType === 'hero'
                          ? 'bg-[#20211F] text-white border-[#20211F]'
                          : 'bg-white text-[#20211F] border-[#B8B5AE]/50'
                      }`}
                    >
                      Primary Hero Photo
                    </button>

                    {selectedProject.galleryImages.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setTargetType('gallery');
                          setTargetGalleryIndex(idx);
                          setPreviewFile(null);
                          setPreviewUrl('');
                        }}
                        className={`px-4 py-2 text-xs font-mono uppercase tracking-wider border cursor-pointer ${
                          targetType === 'gallery' && targetGalleryIndex === idx
                            ? 'bg-[#20211F] text-white border-[#20211F]'
                            : 'bg-white text-[#20211F] border-[#B8B5AE]/50'
                        }`}
                      >
                        Gallery #{idx + 1}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Current Photo vs New Photo Side-by-Side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Current Active Photo */}
                  <div className="border border-[#B8B5AE]/40 p-3 bg-gray-50">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-[#20211F]/60 mb-2">
                      Current Live Photo:
                    </div>
                    <div className="aspect-[16/10] relative w-full overflow-hidden bg-black/10">
                      <Image
                        src={
                          targetType === 'hero'
                            ? selectedProject.heroImage
                            : selectedProject.galleryImages[targetGalleryIndex] || selectedProject.heroImage
                        }
                        alt="Current Photo"
                        fill
                        sizes="400px"
                        className="object-cover"
                      />
                    </div>
                  </div>

                  {/* New Photo Preview */}
                  <div className="border border-[#B8B5AE]/40 p-3 bg-gray-50 flex flex-col justify-between">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-wider text-[#C41E1E] mb-2 font-semibold">
                        New Replacement Preview:
                      </div>
                      <div className="aspect-[16/10] relative w-full overflow-hidden bg-white border-2 border-dashed border-[#B8B5AE]/50 flex items-center justify-center">
                        {previewUrl ? (
                          <Image
                            src={previewUrl}
                            alt="New Preview"
                            fill
                            sizes="400px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="text-center p-4 text-[#20211F]/40 font-mono text-xs">
                            Select a file below to preview here
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* File Picker & Upload Action */}
                <div className="bg-[#F4F1EA]/50 p-6 border border-[#B8B5AE]/30 space-y-4">
                  <label className="block font-mono text-xs uppercase tracking-wider text-[#20211F]/80">
                    2. Upload Genuine Project Photo (JPEG, PNG, WebP &mdash; max 10MB):
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="block w-full text-xs text-[#20211F] file:mr-4 file:py-2.5 file:px-4 file:border-0 file:text-xs file:font-mono file:uppercase file:tracking-wider file:bg-[#20211F] file:text-white hover:file:bg-[#C41E1E] file:cursor-pointer"
                  />

                  {uploadSuccess && (
                    <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-xs font-mono">
                      ✓ {uploadSuccess}
                    </div>
                  )}

                  {uploadError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-[#C41E1E] text-xs font-mono">
                      ✗ {uploadError}
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between">
                    <span className="font-mono text-[10px] text-[#20211F]/50">
                      Recommendation: 16:9 or 4:3 ratio, minimum 1600px width.
                    </span>

                    <button
                      onClick={handleUpload}
                      disabled={!previewFile || isUploading}
                      className="px-6 py-3 bg-[#C41E1E] hover:bg-[#a01818] text-white font-mono text-xs uppercase tracking-[0.2em] font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-md"
                    >
                      {isUploading ? 'Uploading...' : 'Save & Replace Photo'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-[#20211F]/50 font-mono text-xs">
                Select a project on the left to begin.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
