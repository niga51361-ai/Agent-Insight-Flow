/**
 * Onboarding Types
 * Shared types for the professional onboarding system
 */

export type AgentPersonality = 'analytical' | 'creative' | 'friendly' | 'professional';

export type ChatBackground = 'default' | 'ocean' | 'forest' | 'sunset' | 'midnight' | 'nebula';

export interface OnboardingData {
  agentName: string;
  agentPersonality: AgentPersonality;
  userInterests: string[];
  userBackground?: string;
  chatBackground: ChatBackground;
}

export interface UserProfile {
  id: number;
  email: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  agentName?: string;
  agentPersonality?: AgentPersonality;
  userInterests?: string[];
  userBackground?: string;
  chatBackground?: string;
  onboardingCompleted: boolean;
  createdAt: string;
}

export interface PersonalityOption {
  id: AgentPersonality;
  name: string;
  description: string;
  icon: string;
  color: string;
  borderColor: string;
  hoverColor: string;
}

export interface BackgroundOption {
  id: ChatBackground;
  name: string;
  color: string;
}

export const PREDEFINED_INTERESTS = [
  'Technology',
  'Business',
  'Science',
  'Arts',
  'Sports',
  'Travel',
  'Food',
  'Music',
  'Learning',
] as const;

export type PredefinedInterest = typeof PREDEFINED_INTERESTS[number];
