'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';

export default function FeedbackPage() {
  const [formState, setFormState] = useState({
    customerName: '',
    email: '',
    projectReference: '',
    rating: 5,
    message: '',
    permissionToPublish: true,
  });

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const idempotencyKeyRef = React.useRef<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrorMsg('');

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    try {
      const payload = {
        ...formState,
        email: formState.email.trim() || undefined,
        projectReference: formState.projectReference.trim() || undefined,
      };
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKeyRef.current,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit feedback');
      }

      idempotencyKeyRef.current = '';
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission error. Please try again.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="w-full min-h-screen bg-ivory text-charcoal">
      <section className="relative pt-36 pb-16 md:pt-44 md:pb-24 border-b border-warm-grey/30 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
        <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium block mb-4">
          [ 01 / CLIENT REFLECTIONS ]
        </span>
        <h1 className="type-page-title text-4xl sm:text-5xl md:text-6xl text-charcoal max-w-4xl mb-6">
          Client Feedback &amp; Project Evaluation
        </h1>
        <p className="font-sans text-lg text-charcoal/80 max-w-2xl leading-relaxed">
          Your feedback ensures our craftsmen maintain strict Level 5 standards and seamless trade collaboration.
        </p>
      </section>

      <section className="py-20 px-6 sm:px-8 lg:px-12 max-w-3xl mx-auto">
        <div className="bg-white border border-warm-grey/40 p-8 sm:p-12">
          {submitted ? (
            <div className="p-8 bg-ivory border border-bronze text-center space-y-4">
              <span className="type-card-title text-2xl text-charcoal block">Thank You For Your Evaluation</span>
              <p className="font-sans text-sm text-charcoal/80 max-w-md mx-auto">
                Your feedback has been received and securely stored. As part of our governance protocol, all testimonials are reviewed by management before publication.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {errorMsg && (
                <div className="p-4 bg-red-50 border border-red-300 text-xs text-red-800">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Input
                  label="Client Name"
                  required
                  placeholder="Your full name"
                  value={formState.customerName}
                  onChange={(e) => setFormState({ ...formState, customerName: e.target.value })}
                />
                <Input
                  label="Email (Optional)"
                  type="email"
                  placeholder="you@example.com"
                  value={formState.email}
                  onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                />
              </div>

              <Input
                label="Project Reference / Suburb"
                required
                placeholder="e.g. Norwood Interior Repaint or Adelaide Residence"
                value={formState.projectReference}
                onChange={(e) => setFormState({ ...formState, projectReference: e.target.value })}
              />

              {/* Rating Selector */}
              <div>
                <span className="font-sans text-xs uppercase tracking-wider text-warm-grey-dark block mb-2">
                  Overall Craftsmanship Rating *
                </span>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFormState({ ...formState, rating: star })}
                      className={`w-12 h-10 border font-mono text-sm transition-all cursor-pointer ${
                        formState.rating >= star
                          ? 'bg-bronze text-white border-bronze'
                          : 'bg-white text-charcoal/60 border-warm-grey/40 hover:border-bronze'
                      }`}
                    >
                      {star} ★
                    </button>
                  ))}
                </div>
              </div>

              <Textarea
                label="Evaluation &amp; Feedback Message"
                required
                rows={5}
                placeholder="Describe the site cleanliness, surface finish quality, and trade coordination..."
                value={formState.message}
                onChange={(e) => setFormState({ ...formState, message: e.target.value })}
              />

              <label className="flex items-start gap-3 cursor-pointer text-xs font-sans text-charcoal/80 pt-2">
                <input
                  type="checkbox"
                  checked={formState.permissionToPublish}
                  onChange={(e) => setFormState({ ...formState, permissionToPublish: e.target.checked })}
                  className="mt-0.5 accent-bronze"
                />
                <span>
                  I grant permission for Strovyn Painting Co. to display this endorsement publicly following managerial review.
                </span>
              </label>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                className="w-full text-center"
              >
                Submit Project Evaluation
              </Button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
