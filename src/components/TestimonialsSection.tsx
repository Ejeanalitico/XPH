import React from 'react';
import { Testimonial } from '../types';

interface TestimonialsSectionProps {
  testimonials: Testimonial[];
  onAddTestimonial: (newTestimonial: Omit<Testimonial, 'id' | 'verified'>) => void;
  onShowToast: (title: string, description?: string, type?: 'info' | 'success' | 'warning') => void;
}

export const TestimonialsSection: React.FC<TestimonialsSectionProps> = () => null;
