
import React from 'react';
import type { Module, Quiz, Lesson } from '../types';
import { ListeningIcon, SpeakingIcon, ReadingIcon, AirlineIcon, GlobeIcon, PhoneIcon, ChartBarIcon } from '../components/Icons';
import { ResourceType } from '../types';

const listeningLessons: Lesson[] = [
    { title: 'Global Business Phonetics', level: 'B1', type: ResourceType.Listen, link: 'https://thebusinessenglish podcast.com/blog-ep50', duration: '15 min', objective: 'Mastering professional greetings and phonetic clarity.' },
    { title: 'Active Listening for Client Care', level: 'B1', type: ResourceType.Listen, link: 'https://thebusinessenglish podcast.com/blog-ep68', duration: '20 min', objective: 'Handling complex multi-part requests and technical details.' },
    { title: 'De-escalation & Empathy Skills', level: 'B2', type: ResourceType.Listen, link: 'https://thebusinessenglish podcast.com/blog-ep15', duration: '25 min', objective: 'Managing frustrated clients with high-stakes communication.' },
];

const cultureLessons: Lesson[] = [
    { title: 'Professional Directness & Efficiency', level: 'All', type: ResourceType.Read, duration: '15 min', objective: 'Understanding culture-specific communication styles in business.' },
    { title: 'The FORD Method for Rapport', level: 'All', type: ResourceType.Read, duration: '10 min', objective: 'Building deep rapport through targeted small talk.' },
    { title: 'Dining & Etiquette for Client Support', level: 'B1', type: ResourceType.Watch, link: 'https://www.youtube.com/watch?v=_kItsPSG4tI', duration: '15 min', objective: 'Mastering the nuances of high-end service hospitality.' },
];

const salesLessons: Lesson[] = [
    { title: 'Value-Based Upselling', level: 'B1', type: ResourceType.Practice, duration: '20 min', objective: 'Converting standard support into revenue opportunities.' },
    { title: 'Premium Upgrade Logic', level: 'B2', type: ResourceType.Watch, duration: '12 min', objective: 'Selling benefits rather than features for premium accounts.' },
    { title: 'Mastering Cost Objections', level: 'B1', type: ResourceType.Practice, duration: '15 min', objective: 'Turning price sensitivity into a focus on value.' },
];

const languageLessons: Lesson[] = [
    { title: 'Advanced Grammar Structures', level: 'B2', type: ResourceType.Practice, duration: '20 min', objective: 'Mastering conditional and future-perfect tenses for business.' },
    { title: 'Professional Vocabulary Expansion', level: 'A2', type: ResourceType.Read, duration: '20 min', objective: 'Building a robust bank of industry-standard professional terms.' },
];

export const allTrainingModules: { [id: string]: Module } = {
  language: {
    id: 'language',
    title: 'Core Proficiency',
    icon: React.createElement(ReadingIcon),
    description: 'Master the fundamental grammar and vocabulary required for professional use.',
    lessons: languageLessons,
  },
  culture: {
    id: 'culture',
    title: 'Cultural Intelligence',
    icon: React.createElement(GlobeIcon),
    description: "Bridging communication gaps and managing client expectations.",
    lessons: cultureLessons,
  },
  sales: {
    id: 'sales',
    title: 'Consultative Sales',
    icon: React.createElement(ChartBarIcon),
    description: 'Transforming interactions into revenue-generating conversations.',
    lessons: salesLessons,
  },
  listening: {
    id: 'listening',
    title: 'Active Listening',
    icon: React.createElement(ListeningIcon),
    description: 'Precision listening for complex requests and emotional intelligence.',
    lessons: listeningLessons,
  }
};

export const quizzes: Quiz[] = []; // Obsolete quizzes removed
