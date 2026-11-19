/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  Search, 
  MapPin, 
  Loader2, 
  Menu, 
  Plus, 
  Minus, 
  User, 
  Mail, 
  Lock, 
  Building2, 
  Share2, 
  Zap, 
  Users, 
  UserSearch,
  IdCard,
  PartyPopper,
  FileCheck2,
  Wrench, 
  Hammer, 
  Sparkles, 
  LogOut,
  LogIn,
  Copy,
  Check,
  Navigation,
  Compass,
  Layers,
  Briefcase,
  Shield,
  Star,
  Crown,
  X,
  Camera,
  Upload, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  FileText, 
  Eye, 
  Maximize2, 
  Satellite, 
  Settings, 
  Volume2, 
  VolumeX, 
  Pencil, 
  Trash2, 
  PlusCircle,
  Snowflake,
  Send,
  Info,
  HelpCircle,
  MessageSquare,
  MessageCircle,
  Heart,
  ArrowLeft,
  BookOpen,
  Calendar,
  Globe,
  Phone,
  Store,
  Bot,
  Smartphone
} from 'lucide-react';

import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendEmailVerification,
  signOut as fbSignOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc,
  getDocs,
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  getDocFromServer,
  query,
  where
} from 'firebase/firestore';

const MAIN_TENANT_EMAIL = 'timegig2026@gmail.com';
const MAIN_TENANT_REF_CODE = 'main-timegig2026';
const DEFAULT_REFERRAL_TENANT_COMPANY_LIMIT = 10;
const PENDING_REF_STORAGE_KEY = 'timegig_pending_ref_code';
const SOUND_ENABLED_STORAGE_KEY = 'timegig_sound_enabled';

// Fix default marker icon issue in Leaflet with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface UploadedDoc {
  name: string;
  url: string;
  type: string;
  size?: string;
}

type ReferralTier = 'main_tenant' | 'tenant' | 'user';

interface ReferrerInfo {
  code: string;
  uid: string;
  tier: ReferralTier;
  displayName: string;
}

type SubTierOption = 'Tenant Sub (R299.99)' | 'User Sub (R29.99)' | 'Company Sub (R199.99)';

function getSubCategory(subType?: string): 'tenant' | 'user' | 'company' {
  if (!subType) return 'user';
  if (subType.includes('Tenant')) return 'tenant';
  if (subType.includes('Company')) return 'company';
  return 'user';
}

interface Submission {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  subType: SubTierOption;
  feeAmount?: number;
  selfie: string | null;
  idDoc: UploadedDoc | null;
  popDoc: UploadedDoc | null;
  status: 'pending' | 'approved' | 'rejected' | 'frozen';
  submittedAt: number;
  expiresAt?: number;
  referrerCode: string;
  referrerUid: string;
  referrerTier: ReferralTier;
  targetTenantEmail: string;
  targetTenantUid: string;
  routingLabel?: string;
}

interface TenantOfferConfig {
  tenantFee: number;
  userFee: number;
  companyFee: number;
  trialDays: number;
  companyTrialDays: number;
  maxTenantSignups: number;
  maxUserSignups: number;
  maxCompanySignups: number;
  currentTenantSignups: number;
  currentUserSignups: number;
  currentCompanySignups: number;
  bankName: string;
  bankAccountHolder: string;
  bankAccountNumber: string;
  bankBranchCode: string;
  bankReferenceNote: string;
  approvalHoursEnabled: boolean;
  approvalHoursStart: string;
  approvalHoursEnd: string;
  approvalWorkingDays: string;
}

const DEFAULT_TENANT_CONFIG: TenantOfferConfig = {
  tenantFee: 299.99,
  userFee: 29.99,
  companyFee: 199.99,
  trialDays: 0,
  companyTrialDays: 0,
  maxTenantSignups: 0,
  maxUserSignups: 0,
  maxCompanySignups: 0,
  currentTenantSignups: 0,
  currentUserSignups: 0,
  currentCompanySignups: 0,
  bankName: '',
  bankAccountHolder: '',
  bankAccountNumber: '',
  bankBranchCode: '',
  bankReferenceNote: '',
  approvalHoursEnabled: false,
  approvalHoursStart: '08:00',
  approvalHoursEnd: '17:00',
  approvalWorkingDays: '1,2,3,4,5',
};

const EXPIRY_WARNING_MS = 5 * 24 * 60 * 60 * 1000; // 5 days before subscription ends

interface SeekerProfile {
  uid: string;
  displayName: string;
  location: string;
  avatar: string | null;
  tier: 'tenant' | 'user' | 'company' | 'seeker';
  status: 'inactive' | 'active' | 'pending' | 'approved' | 'rejected' | 'frozen';
  serviceTitle?: string;
  serviceRate?: string;
  serviceDescription?: string;
  offeringService?: boolean;
  lat?: number | null;
  lng?: number | null;
  updatedAt: number;
}

interface ReferralTenantLink {
  code: string;
  ownerUid: string;
  ownerTier: ReferralTier;
  displayName: string;
  maxTenantSignups: number;
  maxUserSignups: number;
  maxCompanySignups: number;
  currentTenantSignups: number;
  currentUserSignups: number;
  currentCompanySignups: number;
}

interface GigPost {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar?: string | null;
  title: string;
  description: string;
  pay: string;
  category: string;
  lat: number;
  lng: number;
  locationName: string;
  gigDate?: string;
  gigTime?: string;
  createdAt: number;
  updatedAt: number;
}

interface HireRecord {
  id: string;
  userId: string;
  userName: string;
  seekerId: string;
  seekerName: string;
  serviceTitle: string;
  serviceRate?: string;
  seekerLat: number;
  seekerLng: number;
  destLat: number;
  destLng: number;
  destAddress: string;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  rating?: number | null;
  ratingComment?: string;
  cancelReason?: string;
  cancelledBy?: 'user' | 'seeker' | null;
  createdAt: number;
  acceptedAt?: number | null;
  completedAt?: number | null;
  cancelledAt?: number | null;
}

interface HireMessage {
  id: string;
  hireId: string;
  userId: string;
  seekerId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string | null;
  text: string;
  createdAt: number;
}

interface SeekerRatingSummary {
  avg: number;
  count: number;
}

interface GigApplication {
  id: string;
  gigId: string;
  gigTitle: string;
  gigOwnerId: string;
  applicantId: string;
  applicantName: string;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
}

interface FeedbackItem {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userTier: 'main_tenant' | 'tenant' | 'user' | 'company' | 'none';
  userAvatar?: string | null;
  userLocation?: string;
  userReferralCode?: string;
  userStatus?: string;
  message: string;
  createdAt: number;
  readByMainTenant?: boolean;
  readAt?: number | null;
  replyMessage?: string;
  repliedAt?: number | null;
  repliedByUid?: string;
  repliedByName?: string;
  repliedByAvatar?: string | null;
}

interface CompanyPost {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar?: string | null;
  logoUrl?: string | null;
  backcoverUrl?: string | null;
  name: string;
  category: string;
  description: string;
  openTimes?: string;
  contact: string;
  email?: string;
  website?: string;
  acceptsReservations?: boolean;
  lat: number;
  lng: number;
  locationName: string;
  createdAt: number;
  updatedAt: number;
}

interface CompanyReservation {
  id: string;
  companyId: string;
  companyName: string;
  companyOwnerId: string;
  userId: string;
  userName: string;
  userEmail: string;
  reservationDate: string;
  reservationTime: string;
  guests?: string;
  contactPhone?: string;
  notes?: string;
  status: 'pending' | 'confirmed' | 'declined' | 'cancelled';
  createdAt: number;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type ActiveTab = 'tenant' | 'referrals' | 'gigs' | 'seekers' | 'profile' | 'settings' | null;
type FeatureInfoKey = Exclude<ActiveTab, null> | 'companies';

const FEATURE_INFO_COPY: Record<
  FeatureInfoKey,
  { title: string; subtitle: string; description: string; highlights: string[] }
> = {
  tenant: {
    title: 'Tenant Dashboard',
    subtitle: 'Earnings, Full-Screen Menu & Feedback',
    description:
      'Monitor your monthly Tenant Sub, User Sub, and Company Sub income, track active subscription counts, and copy your shareable referral link.',
    highlights: [
      'Tap the top-right 3-bar menu to open the full-screen menu with a Top Bar separating Fees, Trial Days, Signups, and Bank Details.',
      'Referral Tenants can set monthly fees & trial days for Tenants, Users, and Companies (capped at 10 Companies by default).',
      'Main Tenant can set total Tenant, User, and Company signups for themselves and every Referral Tenant, plus reply in the Feedback Inbox.',
    ],
  },
  referrals: {
    title: 'Referrals',
    subtitle: 'Tenants, Users & Company Subs',
    description:
      'Manage Referral Tenants, User Sub referrals, and Company Sub referrals in separated sections. Inspect uploaded verification documents and keep subscriptions active.',
    highlights: [
      'Inspect captured face selfie, ID document, and proof-of-payment in full size before approving.',
      'Referral cards automatically turn red when a subscription is within 5 days of ending or has expired.',
      'Only the direct Referrer Tenant can approve, extend (+30 days), reject, freeze, or unfreeze an account.',
    ],
  },
  gigs: {
    title: 'GiGs Map',
    subtitle: 'Live Map, Businesses & Voice Routing',
    description:
      'Search any location at the top of the map, browse pinned Gig posts and Company Pages, and follow turn-by-turn road navigation with voice guidance.',
    highlights: [
      'Tap the Menu icon above Zoom to Create a Gig, Add a Company Page, or open the Businesses directory.',
      'Click any Business Page pin on the map to view full details, book a reservation, or navigate there with a female voice assistant.',
      'View the creator’s face selfie, live views, and interest count on each Gig post before applying.',
    ],
  },
  companies: {
    title: 'Company & Business Gadget',
    subtitle: 'Business Pages, Navigation & Reservations',
    description:
      'Open Businesses from the map Menu icon to browse registered companies, view their full business page, book reservations, and start voice navigation.',
    highlights: [
      'Publish a Company Page with Logo, Backcover, Business Name, Open Times, Contact, Email, Website, and Map Location.',
      'Click any Business pin on the map (or tap Navigate) for turn-by-turn road directions guided by a lady voice.',
      'Users can book, track, or cancel reservations while Company owners confirm or decline requests.',
    ],
  },
  seekers: {
    title: 'Seekers',
    subtitle: 'Service Providers & Live Hiring',
    description:
      'Browse service seekers showcasing their face selfies and verified star ratings, or publish your own Offer Service card to appear in Seekers.',
    highlights: [
      'Tap Hire Out Service and upload or capture a face selfie to publish your service and appear on Seekers.',
      'Hire any active seeker, wait for live acceptance, and automatically launch road navigation + in-app chat on GiGs.',
      'Only the hiring user marks a gig completed and leaves a star rating; either party can cancel with a reason.',
    ],
  },
  profile: {
    title: 'Profile',
    subtitle: 'Account, Timer & Location',
    description:
      'Track your live 30-day or trial countdown timer, manage your personal profile details, and share your User Sub referral link.',
    highlights: [
      'Tap your avatar anytime to take or retake your face selfie displayed across GiGs, map location, and Seekers.',
      'Update Name, Surname, and Location with live address suggestions or GPS auto-detect.',
      'Copy your User Sub referral link, jump to Settings, or Sign Out safely.',
    ],
  },
  settings: {
    title: 'Settings',
    subtitle: 'Sound, Guides & Main Tenant Feedback',
    description:
      'Customize app audio notifications, read interactive guides in Help and About, and send direct feedback to the Main Tenant.',
    highlights: [
      'Toggle click sounds and live alerts for new referrals, new seekers, and new gig posts.',
      'Open Help for step-by-step instructions or About to see how the platform connects gigs and businesses.',
      'Send Feedback to the Main Tenant and check back here for direct replies.',
    ],
  },
};

function buildReferralUrl(code: string): string {
  if (typeof window === 'undefined') return `https://openstreetmap.map/?ref=${code}`;
  return `${window.location.origin}/?ref=${code}`;
}

function extractRefCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const qRef = params.get('ref');
  if (qRef && /^[a-zA-Z0-9_-]{1,128}$/.test(qRef.trim())) {
    return qRef.trim();
  }
  const pathMatch = window.location.pathname.match(/\/(?:tenant\/ref|sub\/user)\/([a-zA-Z0-9_-]+)/);
  if (pathMatch?.[1]) {
    return pathMatch[1];
  }
  return null;
}

function resolveReferralRouting(referrer: ReferrerInfo | null, currentUid?: string) {
  // Prevent self-referral or missing referrer -> falls under Main Tenant
  if (!referrer || (currentUid && referrer.uid && referrer.uid === currentUid) || referrer.tier === 'main_tenant') {
    return {
      referrerCode: referrer?.code || MAIN_TENANT_REF_CODE,
      referrerUid: referrer?.uid || '',
      referrerTier: 'main_tenant' as ReferralTier,
      targetTenantEmail: MAIN_TENANT_EMAIL,
      targetTenantUid: referrer?.uid || '',
      routingLabel: 'Direct to Main Tenant (timegig2026@gmail.com)',
    };
  }

  // Referrals coming from ANY User Sub member (including a Referral Tenant's User Sub referrals)
  // always fall under Main Tenant
  if (referrer.tier === 'user') {
    return {
      referrerCode: referrer.code,
      referrerUid: referrer.uid,
      referrerTier: 'user' as ReferralTier,
      targetTenantEmail: MAIN_TENANT_EMAIL,
      targetTenantUid: '',
      routingLabel: 'Via User Sub → Routed to Main Tenant (timegig2026@gmail.com)',
    };
  }

  // Direct referrals of a Referral Tenant fall under that Referral Tenant
  return {
    referrerCode: referrer.code,
    referrerUid: referrer.uid,
    referrerTier: 'tenant' as ReferralTier,
    targetTenantEmail: '',
    targetTenantUid: referrer.uid,
    routingLabel: `Direct to Referral Tenant (${referrer.displayName || 'Tenant'})`,
  };
}

async function compressImageDataUrl(dataUrl: string, maxDim = 960, quality = 0.72): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export default function App() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const userLocationMarkerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [isSatellite, setIsSatellite] = useState<boolean>(true);
  
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isMainTenant, setIsMainTenant] = useState<boolean>(false);
  const [myReferralCode, setMyReferralCode] = useState<string>('');
  const [pendingRefCode, setPendingRefCode] = useState<string | null>(() => {
    const fromUrl = extractRefCodeFromUrl();
    if (fromUrl) {
      try {
        localStorage.setItem(PENDING_REF_STORAGE_KEY, fromUrl);
      } catch {
        // ignore storage errors
      }
      return fromUrl;
    }
    try {
      return localStorage.getItem(PENDING_REF_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [activeReferrer, setActiveReferrer] = useState<ReferrerInfo | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authTab, setAuthTab] = useState<'signup' | 'signin'>('signup');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);
  const [termsDetailsOpen, setTermsDetailsOpen] = useState<boolean>(false);
  const [congratsModalOpen, setCongratsModalOpen] = useState<boolean>(false);
  const [userProfileLoaded, setUserProfileLoaded] = useState<boolean>(false);
  const [appNotice, setAppNotice] = useState<string | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState<boolean>(false);
  const [onboardingModalOpen, setOnboardingModalOpen] = useState<boolean>(false);
  const [selectedSubTier, setSelectedSubTier] = useState<SubTierOption | null>(null);
  const [chosenSubscription, setChosenSubscription] = useState<'tenant' | 'user' | 'company' | null>(null);
  const [dismissedTenantReminder, setDismissedTenantReminder] = useState<boolean>(false);
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [authResolved, setAuthResolved] = useState<boolean>(false);
  const [startupSubChooserDismissed, setStartupSubChooserDismissed] = useState<boolean>(false);
  const [startupIntentOpen, setStartupIntentOpen] = useState<boolean>(false);
  const [startupIntentChoice, setStartupIntentChoice] = useState<'gig' | 'tenant' | null>(null);
  const [hasCompletedStartupIntent, setHasCompletedStartupIntent] = useState<boolean>(false);
  const startupRedirectDoneRef = useRef<boolean>(false);
  const pendingAuthSubTierRef = useRef<SubTierOption | null>(null);
  const pendingTermsAcceptedAtRef = useRef<number | null>(null);

  // Intro display of app name TimeGiG before signup/signin screen
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('gigs');
  const [tenantMenuOpen, setTenantMenuOpen] = useState<boolean>(false);
  const [tenantMenuSection, setTenantMenuSection] = useState<'fees' | 'trials' | 'limits' | 'bank' | 'hours'>('fees');
  const [myTenantConfig, setMyTenantConfig] = useState<TenantOfferConfig>(DEFAULT_TENANT_CONFIG);
  const [offerConfig, setOfferConfig] = useState<TenantOfferConfig>(DEFAULT_TENANT_CONFIG);
  const [draftTenantFee, setDraftTenantFee] = useState<string>('299.99');
  const [draftUserFee, setDraftUserFee] = useState<string>('29.99');
  const [draftCompanyFee, setDraftCompanyFee] = useState<string>('199.99');
  const [draftTrialDays, setDraftTrialDays] = useState<string>('0');
  const [draftCompanyTrialDays, setDraftCompanyTrialDays] = useState<string>('0');
  const [draftMaxTenantSignups, setDraftMaxTenantSignups] = useState<string>('0');
  const [draftMaxUserSignups, setDraftMaxUserSignups] = useState<string>('0');
  const [draftMaxCompanySignups, setDraftMaxCompanySignups] = useState<string>('0');
  const [draftBankName, setDraftBankName] = useState<string>('');
  const [draftBankAccountHolder, setDraftBankAccountHolder] = useState<string>('');
  const [draftBankAccountNumber, setDraftBankAccountNumber] = useState<string>('');
  const [draftBankBranchCode, setDraftBankBranchCode] = useState<string>('');
  const [draftBankReferenceNote, setDraftBankReferenceNote] = useState<string>('');
  const [draftApprovalHoursEnabled, setDraftApprovalHoursEnabled] = useState<boolean>(false);
  const [draftApprovalHoursStart, setDraftApprovalHoursStart] = useState<string>('08:00');
  const [draftApprovalHoursEnd, setDraftApprovalHoursEnd] = useState<string>('17:00');
  const [draftApprovalWorkingDays, setDraftApprovalWorkingDays] = useState<string>('1,2,3,4,5');
  const [copiedBankAcct, setCopiedBankAcct] = useState<boolean>(false);
  const [isSavingTenantConfig, setIsSavingTenantConfig] = useState<boolean>(false);
  const [tenantConfigSavedMsg, setTenantConfigSavedMsg] = useState<string | null>(null);
  const [myTrialEndsAt, setMyTrialEndsAt] = useState<number | null>(null);
  const [isStartingTrial, setIsStartingTrial] = useState<boolean>(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(SOUND_ENABLED_STORAGE_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef<boolean>(soundEnabled);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const playClickSound = (forcePlay = false) => {
    if (!soundEnabledRef.current && !forcePlay) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(640, now);
      osc.frequency.exponentialRampToValueAtTime(340, now + 0.045);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.055);
    } catch {
      // ignore audio context errors
    }
  };

  const playNotificationSound = () => {
    if (!soundEnabledRef.current) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;
      const notes = [587.33, 880]; // D5 -> A5 chime for new referrals, seekers & gigs
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.085;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.11, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.21);
      });
    } catch {
      // ignore audio context errors
    }
  };

  const toggleSoundEnabled = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundEnabledRef.current = next;
    try {
      localStorage.setItem(SOUND_ENABLED_STORAGE_KEY, String(next));
    } catch {
      // ignore storage errors
    }
    if (next) {
      playClickSound(true);
    }
  };

  // Activity notification tracking refs & Feature Info / Settings / Feedback states
  const seenSeekerIdsRef = useRef<Set<string>>(new Set());
  const seekersInitializedRef = useRef<boolean>(false);
  const seenGigIdsRef = useRef<Set<string>>(new Set());
  const gigsInitializedRef = useRef<boolean>(false);
  const seenSubmissionIdsRef = useRef<Set<string>>(new Set());
  const submissionsInitializedRef = useRef<boolean>(false);
  const seenFeedbackRepliesRef = useRef<Set<string>>(new Set());
  const myFeedbackInitRef = useRef<boolean>(false);

  const [featureInfoTab, setFeatureInfoTab] = useState<FeatureInfoKey | null>(null);
  const [settingsHelpOpen, setSettingsHelpOpen] = useState<boolean>(false);
  const [settingsAboutOpen, setSettingsAboutOpen] = useState<boolean>(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState<boolean>(false);
  const [feedbackInput, setFeedbackInput] = useState<string>('');
  const [isSendingFeedback, setIsSendingFeedback] = useState<boolean>(false);
  const [feedbackSentSuccess, setFeedbackSentSuccess] = useState<boolean>(false);
  const [feedbackInboxOpen, setFeedbackInboxOpen] = useState<boolean>(false);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [myFeedbackList, setMyFeedbackList] = useState<FeedbackItem[]>([]);
  const [replyingFeedbackId, setReplyingFeedbackId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState<string>('');
  const [isSendingReply, setIsSendingReply] = useState<boolean>(false);
  const [mapToolsMenuOpen, setMapToolsMenuOpen] = useState<boolean>(false);
  const [companyGadgetOpen, setCompanyGadgetOpen] = useState<boolean>(false);
  const [companyGadgetQuery, setCompanyGadgetQuery] = useState<string>('');

  // Company map navigation + lady voice guidance
  const [navigatingCompany, setNavigatingCompany] = useState<CompanyPost | null>(null);
  const [companyRouteStats, setCompanyRouteStats] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [companyNavInstruction, setCompanyNavInstruction] = useState<string>('');
  const [companyVoiceMuted, setCompanyVoiceMuted] = useState<boolean>(false);
  const companyVoiceMutedRef = useRef<boolean>(false);
  const navAudioRef = useRef<HTMLAudioElement | null>(null);
  const announcedArrivalCompanyIdRef = useRef<string | null>(null);



  // Profile state
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [locationInput, setLocationInput] = useState<string>('');
  const [contactInfo, setContactInfo] = useState<string>('');
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<SearchResult[]>([]);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Referrals & Seekers search + Service & Hiring state
  const [referralQuery, setReferralQuery] = useState<string>('');
  const [referralStatusFilter, setReferralStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'frozen'>('all');
  const [seekerQuery, setSeekerQuery] = useState<string>('');
  const [seekersList, setSeekersList] = useState<SeekerProfile[]>([]);
  const [seekerRatingsMap, setSeekerRatingsMap] = useState<Record<string, SeekerRatingSummary>>({});
  const [myAvatarThumb, setMyAvatarThumb] = useState<string | null>(null);
  const [myUserCoords, setMyUserCoords] = useState<{ lat: number; lng: number }>({ lat: -26.2041, lng: 28.0473 });

  // Seeker service editor
  const [serviceEditorOpen, setServiceEditorOpen] = useState<boolean>(false);
  const [myServiceTitle, setMyServiceTitle] = useState<string>('');
  const [myServiceRate, setMyServiceRate] = useState<string>('');
  const [myServiceDescription, setMyServiceDescription] = useState<string>('');
  const [myOfferingService, setMyOfferingService] = useState<boolean>(true);
  const [isSavingService, setIsSavingService] = useState<boolean>(false);

  // Main Tenant management of Referral Tenants' total signups
  const [referralTenants, setReferralTenants] = useState<ReferralTenantLink[]>([]);
  const [referralTenantDrafts, setReferralTenantDrafts] = useState<
    Record<string, { maxTenant: string; maxUser: string; maxCompany: string }>
  >({});
  const [savingReferralCode, setSavingReferralCode] = useState<string | null>(null);
  const [savedReferralCode, setSavedReferralCode] = useState<string | null>(null);

  // Hire & Navigation workflow state
  const [outgoingHires, setOutgoingHires] = useState<HireRecord[]>([]);
  const [incomingHires, setIncomingHires] = useState<HireRecord[]>([]);
  const [hireModalSeeker, setHireModalSeeker] = useState<SeekerProfile | null>(null);
  const [hireDestAddress, setHireDestAddress] = useState<string>('');
  const [hireDestLat, setHireDestLat] = useState<number>(-26.2041);
  const [hireDestLng, setHireDestLng] = useState<number>(28.0473);
  const [isSendingHire, setIsSendingHire] = useState<boolean>(false);
  const [routeStats, setRouteStats] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [ratingModalHire, setRatingModalHire] = useState<HireRecord | null>(null);
  const [ratingValue, setRatingValue] = useState<number>(5);
  const [ratingComment, setRatingComment] = useState<string>('');
  const [isCompletingHire, setIsCompletingHire] = useState<boolean>(false);
  const [cancelModalHire, setCancelModalHire] = useState<HireRecord | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState<string>('');
  const [isCancellingHire, setIsCancellingHire] = useState<boolean>(false);
  const [cancelledNoticeHire, setCancelledNoticeHire] = useState<HireRecord | null>(null);
  const prevHireStatusRef = useRef<Record<string, string>>({});

  // User-created GiGs state
  const [gigsList, setGigsList] = useState<GigPost[]>([]);
  const [isPickingGigLocation, setIsPickingGigLocation] = useState<boolean>(false);
  const [gigFormOpen, setGigFormOpen] = useState<boolean>(false);
  const [editingGig, setEditingGig] = useState<GigPost | null>(null);
  const [gigTitle, setGigTitle] = useState<string>('');
  const [gigPay, setGigPay] = useState<string>('');
  const [gigCategory, setGigCategory] = useState<string>('General');
  const [gigDescription, setGigDescription] = useState<string>('');
  const [gigDate, setGigDate] = useState<string>('');
  const [gigTime, setGigTime] = useState<string>('');
  const [gigLat, setGigLat] = useState<number>(-26.2041);
  const [gigLng, setGigLng] = useState<number>(28.0473);
  const [gigLocationName, setGigLocationName] = useState<string>('');
  const [gigLocationSuggestions, setGigLocationSuggestions] = useState<SearchResult[]>([]);
  const [gigLocationPicked, setGigLocationPicked] = useState<boolean>(false);
  const [isSavingGig, setIsSavingGig] = useState<boolean>(false);
  const [viewingGig, setViewingGig] = useState<GigPost | null>(null);
  const [gigViewsCount, setGigViewsCount] = useState<number>(0);
  const [gigInterestsCount, setGigInterestsCount] = useState<number>(0);
  const [hasExpressedInterest, setHasExpressedInterest] = useState<boolean>(false);
  const [isTogglingInterest, setIsTogglingInterest] = useState<boolean>(false);
  const [confirmDeleteGigId, setConfirmDeleteGigId] = useState<string | null>(null);
  const [isDeletingGig, setIsDeletingGig] = useState<boolean>(false);
  const [myGigApplications, setMyGigApplications] = useState<GigApplication[]>([]);
  const [ownerGigApplications, setOwnerGigApplications] = useState<GigApplication[]>([]);
  const [gigApplyMessage, setGigApplyMessage] = useState<string>('');
  const [isApplyingGig, setIsApplyingGig] = useState<boolean>(false);

  // User/Tenant Company Pages & Reservations state
  const [companiesList, setCompaniesList] = useState<CompanyPost[]>([]);
  const [isPickingCompanyLocation, setIsPickingCompanyLocation] = useState<boolean>(false);
  const [companyFormOpen, setCompanyFormOpen] = useState<boolean>(false);
  const [editingCompany, setEditingCompany] = useState<CompanyPost | null>(null);
  const [companyName, setCompanyName] = useState<string>('');
  const [companyCategory, setCompanyCategory] = useState<string>('Services');
  const [companyOpenTimes, setCompanyOpenTimes] = useState<string>('');
  const [companyContact, setCompanyContact] = useState<string>('');
  const [companyEmail, setCompanyEmail] = useState<string>('');
  const [companyWebsite, setCompanyWebsite] = useState<string>('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [companyBackcoverUrl, setCompanyBackcoverUrl] = useState<string | null>(null);
  const [companyAcceptsReservations, setCompanyAcceptsReservations] = useState<boolean>(true);
  const [companyDescription, setCompanyDescription] = useState<string>('');
  const [companyLat, setCompanyLat] = useState<number>(-26.2041);
  const [companyLng, setCompanyLng] = useState<number>(28.0473);
  const [companyLocationName, setCompanyLocationName] = useState<string>('');
  const [companyLocationSuggestions, setCompanyLocationSuggestions] = useState<SearchResult[]>([]);
  const [companyLocationPicked, setCompanyLocationPicked] = useState<boolean>(false);
  const [isSavingCompany, setIsSavingCompany] = useState<boolean>(false);
  const [viewingCompany, setViewingCompany] = useState<CompanyPost | null>(null);
  const [confirmDeleteCompanyId, setConfirmDeleteCompanyId] = useState<string | null>(null);
  const [isDeletingCompany, setIsDeletingCompany] = useState<boolean>(false);
  const [myCompanyReservations, setMyCompanyReservations] = useState<CompanyReservation[]>([]);
  const [ownerCompanyReservations, setOwnerCompanyReservations] = useState<CompanyReservation[]>([]);
  const [resFormOpen, setResFormOpen] = useState<boolean>(false);
  const [resDate, setResDate] = useState<string>('');
  const [resTime, setResTime] = useState<string>('');
  const [resGuests, setResGuests] = useState<string>('1');
  const [resPhone, setResPhone] = useState<string>('');
  const [resNotes, setResNotes] = useState<string>('');
  const [isSubmittingRes, setIsSubmittingRes] = useState<boolean>(false);

  // Live navigation chat between hiring User and navigating Seeker
  const [hireChatOpen, setHireChatOpen] = useState<boolean>(false);
  const [hireChatMessages, setHireChatMessages] = useState<HireMessage[]>([]);
  const [hireChatInput, setHireChatInput] = useState<string>('');
  const [isSendingHireChat, setIsSendingHireChat] = useState<boolean>(false);
  const seenHireMsgIdsRef = useRef<Set<string>>(new Set());
  const hireChatInitRef = useRef<boolean>(false);

  // Map overlay layer refs
  const gigMarkersLayerRef = useRef<L.LayerGroup | null>(null);
  const companyMarkersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const companyRouteLayerRef = useRef<L.LayerGroup | null>(null);
  const isPickingGigRef = useRef<boolean>(false);
  const isPickingCompanyRef = useRef<boolean>(false);

  // Onboarding verification state
  const [selfieCaptured, setSelfieCaptured] = useState<boolean>(false);
  const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(null);
  const [cameraModalOpen, setCameraModalOpen] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const [idUploaded, setIdUploaded] = useState<boolean>(false);
  const [idDocFile, setIdDocFile] = useState<UploadedDoc | null>(null);
  const [popUploaded, setPopUploaded] = useState<boolean>(false);
  const [popDocFile, setPopDocFile] = useState<UploadedDoc | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [viewingSubmission, setViewingSubmission] = useState<Submission | null>(null);
  const [lightboxDoc, setLightboxDoc] = useState<{ title: string; url: string; isImage: boolean; name: string } | null>(null);

  const handleIdFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      let dataUrl = reader.result as string;
      if (file.type.startsWith('image/')) {
        dataUrl = await compressImageDataUrl(dataUrl, 1800, 0.9);
      }
      const sizeStr = file.size > 1024 * 1024 
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
        : `${Math.round(file.size / 1024)} KB`;
      setIdDocFile({
        name: file.name,
        url: dataUrl,
        type: file.type.startsWith('image/') ? 'image/jpeg' : (file.type || 'application/octet-stream'),
        size: sizeStr
      });
      setIdUploaded(true);
    };
    reader.readAsDataURL(file);
  };

  const handlePopFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      let dataUrl = reader.result as string;
      if (file.type.startsWith('image/')) {
        dataUrl = await compressImageDataUrl(dataUrl, 1800, 0.9);
      }
      const sizeStr = file.size > 1024 * 1024 
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
        : `${Math.round(file.size / 1024)} KB`;
      setPopDocFile({
        name: file.name,
        url: dataUrl,
        type: file.type.startsWith('image/') ? 'image/jpeg' : (file.type || 'application/octet-stream'),
        size: sizeStr
      });
      setPopUploaded(true);
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    setCameraModalOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setAppNotice('Unable to access camera. Please ensure camera permissions are enabled in your browser settings.');
      setCameraModalOpen(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraModalOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const rawW = video.videoWidth || 640;
      const rawH = video.videoHeight || 480;
      const maxDim = 720;
      const scale = Math.min(1, maxDim / Math.max(rawW, rawH));
      canvas.width = Math.round(rawW * scale);
      canvas.height = Math.round(rawH * scale);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        setSelfieDataUrl(dataUrl);
        setSelfieCaptured(true);
        stopCamera();
        compressImageDataUrl(dataUrl, 240, 0.65).then((thumb) => {
          setMyAvatarThumb(thumb);
          if (currentUser) {
            const safeThumb = thumb && thumb.length <= 420000 ? thumb : null;
            if (safeThumb) {
              updateDoc(doc(db, 'users', currentUser.uid), { avatar: safeThumb }).catch((err) =>
                console.warn('User avatar sync:', err)
              );
            }
            const safeStatus: 'inactive' | 'active' | 'pending' | 'approved' | 'rejected' | 'frozen' =
              isMainTenant
                ? 'approved'
                : mySubmissionStatus === 'pending' ||
                  mySubmissionStatus === 'approved' ||
                  mySubmissionStatus === 'rejected' ||
                  mySubmissionStatus === 'frozen'
                ? mySubmissionStatus
                : isSubscriptionActive
                ? 'active'
                : 'inactive';
            syncSeekerDoc(currentUser, {
              displayName: `${firstName || currentUser.displayName || 'Member'} ${lastName || ''}`.trim(),
              location: locationInput,
              avatar: thumb,
              tier:
                isMainTenant || chosenSubscription === 'tenant'
                  ? 'tenant'
                  : chosenSubscription === 'company'
                  ? 'company'
                  : chosenSubscription === 'user'
                  ? 'user'
                  : 'seeker',
              status: safeStatus,
            });
          }
        });
      }
    }
  };

  // Submissions state (Referrals list for active tenant: Main Tenant or Referral Tenant)
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  // Dynamically calculate subscription profit from approved submissions
  const tenantSubApprovedList = submissions.filter(
    (s) => s.status === 'approved' && getSubCategory(s.subType) === 'tenant'
  );
  const userSubApprovedList = submissions.filter(
    (s) => s.status === 'approved' && getSubCategory(s.subType) === 'user'
  );
  const companySubApprovedList = submissions.filter(
    (s) => s.status === 'approved' && getSubCategory(s.subType) === 'company'
  );
  const tenantSubApprovedCount = tenantSubApprovedList.length;
  const userSubApprovedCount = userSubApprovedList.length;
  const companySubApprovedCount = companySubApprovedList.length;
  const tenantSubTotalSignups = submissions.filter(
    (s) => s.status !== 'rejected' && getSubCategory(s.subType) === 'tenant'
  ).length;
  const userSubTotalSignups = submissions.filter(
    (s) => s.status !== 'rejected' && getSubCategory(s.subType) === 'user'
  ).length;
  const companySubTotalSignups = submissions.filter(
    (s) => s.status !== 'rejected' && getSubCategory(s.subType) === 'company'
  ).length;

  const tenantProfit = tenantSubApprovedList.reduce(
    (sum, s) => sum + (typeof s.feeAmount === 'number' ? s.feeAmount : myTenantConfig.tenantFee),
    0
  );
  const userProfit = userSubApprovedList.reduce(
    (sum, s) => sum + (typeof s.feeAmount === 'number' ? s.feeAmount : myTenantConfig.userFee),
    0
  );
  const companyProfit = companySubApprovedList.reduce(
    (sum, s) => sum + (typeof s.feeAmount === 'number' ? s.feeAmount : myTenantConfig.companyFee),
    0
  );
  const totalProfit = tenantProfit + userProfit + companyProfit;

  const [mySubmissionStatus, setMySubmissionStatus] = useState<'none' | 'pending' | 'approved' | 'rejected' | 'frozen'>('none');
  const [myApprovalExpiry, setMyApprovalExpiry] = useState<number | null>(null);

  const hasActiveTrial = typeof myTrialEndsAt === 'number' && myTrialEndsAt > nowMs;
  const isTrialExpired = typeof myTrialEndsAt === 'number' && myTrialEndsAt <= nowMs;
  const hasActiveApproval =
    mySubmissionStatus === 'approved' &&
    (myApprovalExpiry === null || myApprovalExpiry > nowMs);
  const isApprovalExpired =
    mySubmissionStatus === 'approved' &&
    typeof myApprovalExpiry === 'number' &&
    myApprovalExpiry <= nowMs;
  const isSubscriptionEnded =
    !isMainTenant &&
    (isApprovalExpired ||
      (mySubmissionStatus === 'none' && isTrialExpired) ||
      mySubmissionStatus === 'rejected');
  const isSubscriptionActive =
    isMainTenant ||
    hasActiveApproval ||
    hasActiveTrial ||
    mySubmissionStatus === 'pending';
  const isSubscriptionLocked =
    !isMainTenant && chosenSubscription !== null && !isSubscriptionEnded;

  // Startup routing: Splash -> What User Wants to Do (new signups) / Login -> Congrats -> Subscription Screen
  useEffect(() => {
    if (showSplash || !authResolved) return;
    if (!isAuthenticated) {
      if (!hasCompletedStartupIntent && !authModalOpen) {
        setStartupIntentOpen(true);
      } else if (!authModalOpen) {
        setAuthModalOpen(true);
      }
      return;
    }
    setStartupIntentOpen(false);
    if (
      userProfileLoaded &&
      !isMainTenant &&
      (!chosenSubscription || isSubscriptionEnded) &&
      !congratsModalOpen &&
      !onboardingModalOpen &&
      !startupSubChooserDismissed
    ) {
      setUpgradeModalOpen(true);
    }
  }, [
    showSplash,
    authResolved,
    isAuthenticated,
    hasCompletedStartupIntent,
    authModalOpen,
    userProfileLoaded,
    isMainTenant,
    chosenSubscription,
    isSubscriptionEnded,
    congratsModalOpen,
    onboardingModalOpen,
    startupSubChooserDismissed,
  ]);

  // Keep inactive or expired users restricted to GiGs view until they choose and activate a subscription
  useEffect(() => {
    if (isAuthenticated && !isMainTenant && !isSubscriptionActive) {
      if (activeTab && activeTab !== 'gigs' && activeTab !== 'settings') {
        setActiveTab('gigs');
      }
    }
  }, [isAuthenticated, isMainTenant, isSubscriptionActive, activeTab]);

  // Countdown timer string
  const [timeLeft, setTimeLeft] = useState<string>('30d 00h 00m');

  // Update countdown timer and active expiry clock every second
  useEffect(() => {
    const updateClock = () => {
      const currentNow = Date.now();
      setNowMs(currentNow);
      const expiry =
        mySubmissionStatus === 'approved'
          ? myApprovalExpiry
          : myTrialEndsAt && mySubmissionStatus === 'none'
          ? myTrialEndsAt
          : null;
      if (!expiry) {
        setTimeLeft('Not Activated');
        return;
      }
      const diff = expiry - currentNow;
      if (diff <= 0) {
        setTimeLeft('Expired');
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        setTimeLeft(`${days}d ${hours}h ${minutes}m remaining`);
      }
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [myApprovalExpiry, myTrialEndsAt, mySubmissionStatus]);

  // Helper to sync user's non-PII profile into /seekers/{uid}
  const syncSeekerDoc = async (
    fbUser: FirebaseUser,
    opts: {
      displayName?: string;
      location?: string;
      avatar?: string | null;
      tier?: 'tenant' | 'user' | 'company' | 'seeker';
      status?: 'inactive' | 'active' | 'pending' | 'approved' | 'rejected' | 'frozen';
    }
  ) => {
    const safeName =
      (opts.displayName || fbUser.displayName || fbUser.email?.split('@')[0] || 'Member').trim().slice(0, 150) ||
      'Member';
    const safeAvatar = opts.avatar && opts.avatar.length <= 420000 ? opts.avatar : null;
    try {
      await setDoc(
        doc(db, 'seekers', fbUser.uid),
        {
          uid: fbUser.uid,
          displayName: safeName,
          location: (opts.location || '').slice(0, 280),
          avatar: safeAvatar,
          tier: opts.tier || 'seeker',
          status: opts.status || 'active',
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Seeker directory sync skipped:', err);
    }
  };

  // Helper to sync user's shareable referral link in /referralLinks/{code}
  const syncReferralLinkDoc = async (
    fbUser: FirebaseUser,
    code: string,
    ownerTier: ReferralTier,
    displayName: string
  ) => {
    try {
      const linkRef = doc(db, 'referralLinks', code);
      const existingLinkSnap = await getDoc(linkRef).catch(() => null);
      const basePayload: Record<string, unknown> = {
        code,
        ownerUid: fbUser.uid,
        ownerTier,
        displayName: displayName || fbUser.displayName || 'Tenant',
        updatedAt: Date.now(),
      };
      if (!existingLinkSnap || !existingLinkSnap.exists()) {
        basePayload.maxCompanySignups =
          ownerTier === 'main_tenant' ? 0 : DEFAULT_REFERRAL_TENANT_COMPANY_LIMIT;
      }
      await setDoc(linkRef, basePayload, { merge: true });
    } catch (err) {
      console.warn('Referral link sync skipped:', err);
    }
  };

  // Ensure a referral submission is recorded for the target tenant (Main Tenant receives all User Sub referrals)
  const ensureSignupReferralSubmission = async (
    fbUser: FirebaseUser,
    routing: ReturnType<typeof resolveReferralRouting>,
    tierName: SubTierOption = 'User Sub (R29.99)',
    displayNameOverride?: string
  ) => {
    if (!routing.referrerUid || routing.referrerUid === fbUser.uid) return;
    try {
      const existingSubs = await getDocs(
        query(collection(db, 'submissions'), where('userId', '==', fbUser.uid))
      );
      if (!existingSubs.empty) return;

      const subId = `sub-ref-${fbUser.uid}`;
      const now = Date.now();
      const userName =
        (displayNameOverride || fbUser.displayName || fbUser.email?.split('@')[0] || 'New User')
          .trim()
          .slice(0, 160) || 'New User';

      const newSub: Submission = {
        id: subId,
        userId: fbUser.uid,
        userName,
        userEmail: (fbUser.email || '').slice(0, 320),
        subType: tierName,
        feeAmount: 0,
        selfie: null,
        idDoc: null,
        popDoc: null,
        status: 'pending',
        submittedAt: now,
        referrerCode: routing.referrerCode,
        referrerUid: routing.referrerUid,
        referrerTier: routing.referrerTier,
        targetTenantEmail: routing.targetTenantEmail,
        targetTenantUid: routing.targetTenantUid,
        routingLabel: routing.routingLabel,
      };
      await setDoc(doc(db, 'submissions', subId), newSub);
    } catch (err) {
      console.warn('Auto referral submission skipped:', err);
    }
  };

  // Listen to Firebase Auth state & resolve referral attribution
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      setAuthResolved(true);
      if (fbUser) {
        setUserProfileLoaded(false);
        setCurrentUser(fbUser);
        setIsAuthenticated(true);
        if (!startupRedirectDoneRef.current) {
          startupRedirectDoneRef.current = true;
          setActiveTab('gigs');
        }
        const normalizedEmail = (fbUser.email || '').trim().toLowerCase();
        const userIsMain = normalizedEmail === MAIN_TENANT_EMAIL;
        setIsMainTenant(userIsMain);

        if (fbUser.email) setEmail(fbUser.email);
        const displayFirst = fbUser.displayName?.split(' ')[0] || '';
        const displayLast = fbUser.displayName?.split(' ').slice(1).join(' ') || '';
        if (displayFirst) setFirstName(displayFirst);
        if (displayLast) setLastName(displayLast);

        const defaultCode = userIsMain ? MAIN_TENANT_REF_CODE : `ref-${fbUser.uid.slice(0, 10)}`;

        try {
          const userDocRef = doc(db, 'users', fbUser.uid);
          const snap = await getDocFromServer(userDocRef);
          const existingData = snap.exists() ? snap.data() : null;

          const resolvedCode: string = userIsMain
            ? MAIN_TENANT_REF_CODE
            : (existingData?.referralCode || defaultCode);
          setMyReferralCode(resolvedCode);

          // Resolve pending referral link if present (and not already locked by an active submission)
          let resolvedReferrer: ReferrerInfo | null = null;
          const urlRef = extractRefCodeFromUrl() || pendingRefCode;
          const shouldResolveFromRef =
            !userIsMain &&
            urlRef &&
            (!existingData?.referredByCode || !existingData?.subscriptionTier || existingData.subscriptionTier === 'none');

          if (shouldResolveFromRef && urlRef) {
            if (urlRef === MAIN_TENANT_REF_CODE) {
              let mainUid = '';
              try {
                const mainSnap = await getDoc(doc(db, 'referralLinks', MAIN_TENANT_REF_CODE));
                if (mainSnap.exists()) mainUid = mainSnap.data().ownerUid || '';
              } catch {
                // ignore if main tenant has not signed in yet
              }
              resolvedReferrer = {
                code: MAIN_TENANT_REF_CODE,
                uid: mainUid,
                tier: 'main_tenant',
                displayName: 'Main Tenant',
              };
            } else {
              try {
                const linkSnap = await getDoc(doc(db, 'referralLinks', urlRef));
                if (linkSnap.exists()) {
                  const linkData = linkSnap.data();
                  if (linkData.ownerUid && linkData.ownerUid !== fbUser.uid) {
                    resolvedReferrer = {
                      code: linkData.code || urlRef,
                      uid: linkData.ownerUid,
                      tier: (linkData.ownerTier as ReferralTier) || 'user',
                      displayName: linkData.displayName || 'Referrer',
                    };
                  }
                }
              } catch (err) {
                console.warn('Could not resolve referral link:', err);
              }
            }
          } else if (existingData?.referredByCode) {
            resolvedReferrer = {
              code: existingData.referredByCode,
              uid: existingData.referredByUid || '',
              tier: (existingData.referredByTier as ReferralTier) || 'main_tenant',
              displayName: existingData.referredByCode === MAIN_TENANT_REF_CODE ? 'Main Tenant' : 'Referrer',
            };
          }

          if (!resolvedReferrer && !userIsMain) {
            resolvedReferrer = {
              code: MAIN_TENANT_REF_CODE,
              uid: '',
              tier: 'main_tenant',
              displayName: 'Main Tenant',
            };
          }

          setActiveReferrer(resolvedReferrer);
          const routing = resolveReferralRouting(resolvedReferrer, fbUser.uid);

          const resolvedOfferCode =
            routing.referrerTier === 'tenant' && routing.referrerCode
              ? routing.referrerCode
              : MAIN_TENANT_REF_CODE;
          try {
            const offerSnap = await getDoc(doc(db, 'referralLinks', resolvedOfferCode));
            if (offerSnap.exists()) {
              const d = offerSnap.data();
              setOfferConfig({
                tenantFee: typeof d.tenantFee === 'number' ? d.tenantFee : 299.99,
                userFee: typeof d.userFee === 'number' ? d.userFee : 29.99,
                companyFee: typeof d.companyFee === 'number' ? d.companyFee : 199.99,
                trialDays: typeof d.trialDays === 'number' ? d.trialDays : 0,
                companyTrialDays: typeof d.companyTrialDays === 'number' ? d.companyTrialDays : 0,
                maxTenantSignups: typeof d.maxTenantSignups === 'number' ? d.maxTenantSignups : 0,
                maxUserSignups: typeof d.maxUserSignups === 'number' ? d.maxUserSignups : 0,
                maxCompanySignups:
                  typeof d.maxCompanySignups === 'number'
                    ? d.maxCompanySignups
                    : routing.referrerTier === 'tenant'
                    ? DEFAULT_REFERRAL_TENANT_COMPANY_LIMIT
                    : 0,
                currentTenantSignups: typeof d.currentTenantSignups === 'number' ? d.currentTenantSignups : 0,
                currentUserSignups: typeof d.currentUserSignups === 'number' ? d.currentUserSignups : 0,
                currentCompanySignups: typeof d.currentCompanySignups === 'number' ? d.currentCompanySignups : 0,
                bankName: typeof d.bankName === 'string' ? d.bankName : '',
                bankAccountHolder: typeof d.bankAccountHolder === 'string' ? d.bankAccountHolder : '',
                bankAccountNumber: typeof d.bankAccountNumber === 'string' ? d.bankAccountNumber : '',
                bankBranchCode: typeof d.bankBranchCode === 'string' ? d.bankBranchCode : '',
                bankReferenceNote: typeof d.bankReferenceNote === 'string' ? d.bankReferenceNote : '',
                approvalHoursEnabled: typeof d.approvalHoursEnabled === 'boolean' ? d.approvalHoursEnabled : false,
                approvalHoursStart: typeof d.approvalHoursStart === 'string' ? d.approvalHoursStart : '08:00',
                approvalHoursEnd: typeof d.approvalHoursEnd === 'string' ? d.approvalHoursEnd : '17:00',
                approvalWorkingDays: typeof d.approvalWorkingDays === 'string' ? d.approvalWorkingDays : '1,2,3,4,5',
              });
            } else {
              setOfferConfig(DEFAULT_TENANT_CONFIG);
            }
          } catch {
            setOfferConfig(DEFAULT_TENANT_CONFIG);
          }

          try {
            const myLinkSnap = await getDoc(doc(db, 'referralLinks', resolvedCode));
            if (myLinkSnap.exists()) {
              const md = myLinkSnap.data();
              const loadedCfg: TenantOfferConfig = {
                tenantFee: typeof md.tenantFee === 'number' ? md.tenantFee : 299.99,
                userFee: typeof md.userFee === 'number' ? md.userFee : 29.99,
                companyFee: typeof md.companyFee === 'number' ? md.companyFee : 199.99,
                trialDays: typeof md.trialDays === 'number' ? md.trialDays : 0,
                companyTrialDays: typeof md.companyTrialDays === 'number' ? md.companyTrialDays : 0,
                maxTenantSignups: typeof md.maxTenantSignups === 'number' ? md.maxTenantSignups : 0,
                maxUserSignups: typeof md.maxUserSignups === 'number' ? md.maxUserSignups : 0,
                maxCompanySignups:
                  typeof md.maxCompanySignups === 'number'
                    ? md.maxCompanySignups
                    : userIsMain
                    ? 0
                    : DEFAULT_REFERRAL_TENANT_COMPANY_LIMIT,
                currentTenantSignups: typeof md.currentTenantSignups === 'number' ? md.currentTenantSignups : 0,
                currentUserSignups: typeof md.currentUserSignups === 'number' ? md.currentUserSignups : 0,
                currentCompanySignups: typeof md.currentCompanySignups === 'number' ? md.currentCompanySignups : 0,
                bankName: typeof md.bankName === 'string' ? md.bankName : '',
                bankAccountHolder: typeof md.bankAccountHolder === 'string' ? md.bankAccountHolder : '',
                bankAccountNumber: typeof md.bankAccountNumber === 'string' ? md.bankAccountNumber : '',
                bankBranchCode: typeof md.bankBranchCode === 'string' ? md.bankBranchCode : '',
                bankReferenceNote: typeof md.bankReferenceNote === 'string' ? md.bankReferenceNote : '',
                approvalHoursEnabled: typeof md.approvalHoursEnabled === 'boolean' ? md.approvalHoursEnabled : false,
                approvalHoursStart: typeof md.approvalHoursStart === 'string' ? md.approvalHoursStart : '08:00',
                approvalHoursEnd: typeof md.approvalHoursEnd === 'string' ? md.approvalHoursEnd : '17:00',
                approvalWorkingDays: typeof md.approvalWorkingDays === 'string' ? md.approvalWorkingDays : '1,2,3,4,5',
              };
              setMyTenantConfig(loadedCfg);
              setDraftTenantFee(String(loadedCfg.tenantFee));
              setDraftUserFee(String(loadedCfg.userFee));
              setDraftCompanyFee(String(loadedCfg.companyFee));
              setDraftTrialDays(String(loadedCfg.trialDays));
              setDraftCompanyTrialDays(String(loadedCfg.companyTrialDays));
              setDraftMaxTenantSignups(String(loadedCfg.maxTenantSignups));
              setDraftMaxUserSignups(String(loadedCfg.maxUserSignups));
              setDraftMaxCompanySignups(String(loadedCfg.maxCompanySignups));
              setDraftBankName(loadedCfg.bankName);
              setDraftBankAccountHolder(loadedCfg.bankAccountHolder);
              setDraftBankAccountNumber(loadedCfg.bankAccountNumber);
              setDraftBankBranchCode(loadedCfg.bankBranchCode);
              setDraftBankReferenceNote(loadedCfg.bankReferenceNote);
              setDraftApprovalHoursEnabled(loadedCfg.approvalHoursEnabled);
              setDraftApprovalHoursStart(loadedCfg.approvalHoursStart);
              setDraftApprovalHoursEnd(loadedCfg.approvalHoursEnd);
              setDraftApprovalWorkingDays(loadedCfg.approvalWorkingDays);
            }
          } catch {
            // keep defaults
          }

          if (snap.exists() && existingData) {
            if (existingData.firstName) setFirstName(existingData.firstName);
            if (existingData.lastName) setLastName(existingData.lastName);
            if (existingData.location) setLocationInput(existingData.location);
            if (existingData.contactPhone || existingData.contact) {
              setContactInfo(existingData.contactPhone || existingData.contact);
            }
            if (existingData.selfie) setSelfieDataUrl(existingData.selfie);
            if (existingData.avatar) setMyAvatarThumb(existingData.avatar);
            setMyTrialEndsAt(typeof existingData.trialEndsAt === 'number' ? existingData.trialEndsAt : null);

            if (userIsMain) {
              setChosenSubscription('tenant');
              setMySubmissionStatus('approved');
              setMyApprovalExpiry(Date.now() + 1000 * 60 * 60 * 24 * 365);
              if (!existingData.isMainTenant || !existingData.referralCode || !existingData.createdAt) {
                await updateDoc(userDocRef, {
                  isMainTenant: true,
                  subscriptionTier: 'tenant',
                  subscriptionStatus: 'approved',
                  referralCode: MAIN_TENANT_REF_CODE,
                  createdAt: existingData.createdAt || new Date().toISOString(),
                });
              }
              await syncReferralLinkDoc(
                fbUser,
                MAIN_TENANT_REF_CODE,
                'main_tenant',
                `${existingData.firstName || displayFirst || 'Main'} ${existingData.lastName || displayLast || 'Tenant'}`.trim()
              );
            } else {
              const tier = existingData.subscriptionTier;
              if (tier === 'tenant' || tier === 'user' || tier === 'company') {
                setChosenSubscription(tier);
              } else {
                setChosenSubscription(null);
              }
              const pendingTermsTs = pendingTermsAcceptedAtRef.current;
              pendingTermsAcceptedAtRef.current = null;
              if (
                (shouldResolveFromRef && resolvedReferrer) ||
                !existingData.referralCode ||
                !existingData.createdAt ||
                (pendingTermsTs && !existingData.termsAcceptedAt)
              ) {
                await updateDoc(userDocRef, {
                  referralCode: resolvedCode,
                  createdAt: existingData.createdAt || new Date().toISOString(),
                  ...(pendingTermsTs && !existingData.termsAcceptedAt
                    ? { termsAcceptedAt: pendingTermsTs }
                    : {}),
                  ...(shouldResolveFromRef && resolvedReferrer
                    ? {
                        referredByCode: routing.referrerCode,
                        referredByUid: routing.referrerUid,
                        referredByTier: routing.referrerTier,
                        uplineTenantEmail: routing.targetTenantEmail,
                        uplineTenantUid: routing.targetTenantUid,
                      }
                    : {}),
                });
              }
              const linkTier: ReferralTier = tier === 'tenant' ? 'tenant' : 'user';
              await syncReferralLinkDoc(
                fbUser,
                resolvedCode,
                linkTier,
                `${existingData.firstName || displayFirst || 'Member'} ${existingData.lastName || displayLast || ''}`.trim()
              );
            }
            const seekerTier: 'tenant' | 'user' | 'company' | 'seeker' =
              userIsMain || existingData.subscriptionTier === 'tenant'
                ? 'tenant'
                : existingData.subscriptionTier === 'company'
                ? 'company'
                : existingData.subscriptionTier === 'user'
                ? 'user'
                : 'seeker';
            const rawStatus = existingData.subscriptionStatus;
            const hasActiveTrial = typeof existingData.trialEndsAt === 'number' && existingData.trialEndsAt > Date.now();
            const validSeekerStatus: 'inactive' | 'active' | 'pending' | 'approved' | 'rejected' | 'frozen' =
              userIsMain
                ? 'approved'
                : rawStatus === 'pending' || rawStatus === 'approved' || rawStatus === 'rejected' || rawStatus === 'frozen'
                ? rawStatus
                : hasActiveTrial
                ? 'active'
                : 'inactive';
            await syncSeekerDoc(fbUser, {
              displayName: `${existingData.firstName || displayFirst || ''} ${existingData.lastName || displayLast || ''}`.trim(),
              location: existingData.location || '',
              avatar: existingData.avatar || existingData.selfie || null,
              tier: seekerTier,
              status: validSeekerStatus,
            });
          } else {
            const initialTier = userIsMain ? 'tenant' : 'none';
            const initialStatus = userIsMain ? 'approved' : 'none';
            const pendingTermsTs = pendingTermsAcceptedAtRef.current;
            pendingTermsAcceptedAtRef.current = null;
            await setDoc(userDocRef, {
              uid: fbUser.uid,
              email: fbUser.email || '',
              firstName: displayFirst,
              lastName: displayLast,
              location: '',
              subscriptionTier: initialTier,
              subscriptionStatus: initialStatus,
              isMainTenant: userIsMain,
              referralCode: resolvedCode,
              referredByCode: userIsMain ? MAIN_TENANT_REF_CODE : routing.referrerCode,
              referredByUid: userIsMain ? fbUser.uid : routing.referrerUid,
              referredByTier: userIsMain ? 'main_tenant' : routing.referrerTier,
              uplineTenantEmail: userIsMain ? MAIN_TENANT_EMAIL : routing.targetTenantEmail,
              uplineTenantUid: userIsMain ? fbUser.uid : routing.targetTenantUid,
              ...(pendingTermsTs ? { termsAcceptedAt: pendingTermsTs } : {}),
              createdAt: new Date().toISOString(),
            });

            if (userIsMain) {
              setChosenSubscription('tenant');
              setMySubmissionStatus('approved');
              setMyApprovalExpiry(Date.now() + 1000 * 60 * 60 * 24 * 365);
              await syncReferralLinkDoc(
                fbUser,
                MAIN_TENANT_REF_CODE,
                'main_tenant',
                `${displayFirst || 'Main'} ${displayLast || 'Tenant'}`.trim()
              );
              await syncSeekerDoc(fbUser, {
                displayName: `${displayFirst || 'Main'} ${displayLast || 'Tenant'}`.trim(),
                location: '',
                tier: 'tenant',
                status: 'approved',
              });
            } else {
              await syncReferralLinkDoc(
                fbUser,
                resolvedCode,
                'user',
                `${displayFirst || 'Member'} ${displayLast || ''}`.trim()
              );
              await syncSeekerDoc(fbUser, {
                displayName: `${displayFirst || 'Member'} ${displayLast || ''}`.trim(),
                location: '',
                tier: 'seeker',
                status: 'inactive',
              });
            }
          }
        } catch (err) {
          console.warn('User profile sync:', err);
        } finally {
          setUserProfileLoaded(true);
        }
      } else {
        setUserProfileLoaded(false);
        setCurrentUser(null);
        setIsAuthenticated(false);
        setIsMainTenant(false);
        setMyReferralCode('');
        setSubmissions([]);
        setSeekersList([]);
        setMyAvatarThumb(null);
        setMySubmissionStatus('none');
        setMyApprovalExpiry(null);
        setMyTrialEndsAt(null);
        setMyTenantConfig(DEFAULT_TENANT_CONFIG);
        setOfferConfig(DEFAULT_TENANT_CONFIG);
        setDraftCompanyFee(String(DEFAULT_TENANT_CONFIG.companyFee));
        setDraftCompanyTrialDays(String(DEFAULT_TENANT_CONFIG.companyTrialDays));
        setDraftMaxCompanySignups(String(DEFAULT_TENANT_CONFIG.maxCompanySignups));
        setDraftBankName('');
        setDraftBankAccountHolder('');
        setDraftBankAccountNumber('');
        setDraftBankBranchCode('');
        setDraftBankReferenceNote('');
        setDraftApprovalHoursEnabled(false);
        setDraftApprovalHoursStart('08:00');
        setDraftApprovalHoursEnd('17:00');
        setDraftApprovalWorkingDays('1,2,3,4,5');
        setTenantMenuOpen(false);
        setTenantMenuSection('fees');
      }
    });

    return () => unsubscribe();
  }, [pendingRefCode]);

  // Real-time synchronization of user's own submission status
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;

    const mySubsQuery = query(
      collection(db, 'submissions'),
      where('userId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      mySubsQuery,
      (snapshot) => {
        const mySubs: Submission[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          mySubs.push({
            id: docSnap.id,
            userId: data.userId || '',
            userName: data.userName || 'Anonymous',
            userEmail: data.userEmail || '',
            subType: data.subType || 'User Sub (R29.99)',
            selfie: data.selfie || null,
            idDoc: data.idDoc || null,
            popDoc: data.popDoc || null,
            status: data.status || 'pending',
            submittedAt: data.submittedAt || Date.now(),
            expiresAt: data.expiresAt,
            referrerCode: data.referrerCode || MAIN_TENANT_REF_CODE,
            referrerUid: data.referrerUid || '',
            referrerTier: data.referrerTier || 'main_tenant',
            targetTenantEmail: data.targetTenantEmail || MAIN_TENANT_EMAIL,
            targetTenantUid: data.targetTenantUid || '',
            routingLabel: data.routingLabel,
          });
        });
        mySubs.sort((a, b) => b.submittedAt - a.submittedAt);

        if (!isMainTenant && mySubs.length > 0) {
          const latest = mySubs[0];
          setMySubmissionStatus(latest.status);
          if (latest.status === 'frozen') {
            setAppNotice('Your referral account has been frozen by your tenant.');
          }
          if (latest.expiresAt) {
            setMyApprovalExpiry(latest.expiresAt);
          }
          const subTier: 'tenant' | 'user' | 'company' = getSubCategory(latest.subType);
          setChosenSubscription(subTier);
          if (latest.selfie) {
            setMyAvatarThumb(latest.selfie);
          }
          if (myReferralCode) {
            const effectiveOwnerTier: ReferralTier =
              latest.status === 'rejected' ? 'user' : subTier === 'tenant' ? 'tenant' : 'user';
            syncReferralLinkDoc(
              currentUser,
              myReferralCode,
              effectiveOwnerTier,
              `${firstName || currentUser.displayName || 'Member'} ${lastName || ''}`.trim()
            );
          }
          syncSeekerDoc(currentUser, {
            displayName: latest.userName || `${firstName} ${lastName}`.trim(),
            location: locationInput,
            avatar: latest.selfie || myAvatarThumb,
            tier: subTier,
            status: latest.status,
          });
          updateDoc(doc(db, 'users', currentUser.uid), {
            subscriptionTier: subTier,
            subscriptionStatus: latest.status,
          }).catch(() => {});
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, `submissions?userId=${currentUser.uid}`);
        } catch {
          setAppNotice('Unable to sync your subscription status. Please verify your sign-in session.');
        }
      }
    );

    return () => unsubscribe();
  }, [isAuthenticated, currentUser, isMainTenant, myReferralCode]);

  // Real-time synchronization of real seekers directory
  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      seenSeekerIdsRef.current = new Set();
      seekersInitializedRef.current = false;
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'seekers'),
      (snapshot) => {
        const loaded: SeekerProfile[] = [];
        const activeSeekerIds = new Set<string>();
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const item: SeekerProfile = {
            uid: data.uid || docSnap.id,
            displayName: data.displayName || 'Member',
            location: data.location || '',
            avatar: data.avatar || null,
            tier: data.tier || 'seeker',
            status: data.status || 'active',
            serviceTitle: data.serviceTitle || '',
            serviceRate: data.serviceRate || '',
            serviceDescription: data.serviceDescription || '',
            offeringService: data.offeringService !== false,
            lat: typeof data.lat === 'number' ? data.lat : null,
            lng: typeof data.lng === 'number' ? data.lng : null,
            updatedAt: data.updatedAt || Date.now(),
          };
          loaded.push(item);
          if (
            item.offeringService !== false &&
            Boolean(item.serviceTitle && item.serviceTitle.trim()) &&
            item.status !== 'frozen' &&
            item.status !== 'rejected'
          ) {
            activeSeekerIds.add(item.uid);
          }
          if (item.uid === currentUser.uid) {
            if (item.avatar) setMyAvatarThumb(item.avatar);
            if (data.serviceTitle !== undefined) setMyServiceTitle(data.serviceTitle || '');
            if (data.serviceRate !== undefined) setMyServiceRate(data.serviceRate || '');
            if (data.serviceDescription !== undefined) setMyServiceDescription(data.serviceDescription || '');
            if (data.offeringService !== undefined) setMyOfferingService(data.offeringService !== false);
          }
        });
        if (seekersInitializedRef.current) {
          let hasNewSeeker = false;
          activeSeekerIds.forEach((id) => {
            if (!seenSeekerIdsRef.current.has(id)) {
              hasNewSeeker = true;
            }
          });
          if (hasNewSeeker) {
            playNotificationSound();
          }
        }
        seenSeekerIdsRef.current = activeSeekerIds;
        seekersInitializedRef.current = true;
        loaded.sort((a, b) => b.updatedAt - a.updatedAt);
        setSeekersList(loaded);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'seekers');
        } catch {
          console.warn('Seekers sync error');
        }
      }
    );

    return () => {
      seekersInitializedRef.current = false;
      unsubscribe();
    };
  }, [isAuthenticated, currentUser]);

  // Real-time synchronization of verified seeker star ratings
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;

    const unsubscribe = onSnapshot(
      collection(db, 'seekerRatings'),
      (snapshot) => {
        const buckets: Record<string, { sum: number; count: number }> = {};
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.seekerId && typeof d.rating === 'number') {
            if (!buckets[d.seekerId]) buckets[d.seekerId] = { sum: 0, count: 0 };
            buckets[d.seekerId].sum += d.rating;
            buckets[d.seekerId].count += 1;
          }
        });
        const summary: Record<string, SeekerRatingSummary> = {};
        Object.entries(buckets).forEach(([uid, b]) => {
          summary[uid] = { avg: b.sum / b.count, count: b.count };
        });
        setSeekerRatingsMap(summary);
      },
      () => {
        // non-fatal
      }
    );

    return () => unsubscribe();
  }, [isAuthenticated, currentUser]);

  // Real-time synchronization of user-posted GiGs
  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      seenGigIdsRef.current = new Set();
      gigsInitializedRef.current = false;
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'gigs'),
      (snapshot) => {
        const loaded: GigPost[] = [];
        const currentGigIds = new Set<string>();
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (typeof d.lat === 'number' && typeof d.lng === 'number') {
            const gigId = d.id || docSnap.id;
            currentGigIds.add(gigId);
            loaded.push({
              id: gigId,
              ownerId: d.ownerId || '',
              ownerName: d.ownerName || 'User',
              ownerAvatar: d.ownerAvatar || null,
              title: d.title || 'Gig',
              description: d.description || '',
              pay: d.pay || '',
              category: d.category || 'General',
              lat: d.lat,
              lng: d.lng,
              locationName: d.locationName || `${d.lat.toFixed(4)}, ${d.lng.toFixed(4)}`,
              gigDate: d.gigDate || '',
              gigTime: d.gigTime || '',
              createdAt: d.createdAt || Date.now(),
              updatedAt: d.updatedAt || Date.now(),
            });
          }
        });
        if (gigsInitializedRef.current) {
          let hasNewGig = false;
          currentGigIds.forEach((id) => {
            if (!seenGigIdsRef.current.has(id)) {
              hasNewGig = true;
            }
          });
          if (hasNewGig) {
            playNotificationSound();
          }
        }
        seenGigIdsRef.current = currentGigIds;
        gigsInitializedRef.current = true;
        loaded.sort((a, b) => b.createdAt - a.createdAt);
        setGigsList(loaded);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'gigs');
        } catch {
          console.warn('Gigs sync error');
        }
      }
    );

    return () => {
      gigsInitializedRef.current = false;
      unsubscribe();
    };
  }, [isAuthenticated, currentUser]);

  // Real-time synchronization of map Company Pages
  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      setCompaniesList([]);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'companies'),
      (snapshot) => {
        const loaded: CompanyPost[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (typeof d.lat === 'number' && typeof d.lng === 'number') {
            loaded.push({
              id: d.id || docSnap.id,
              ownerId: d.ownerId || '',
              ownerName: d.ownerName || 'Owner',
              ownerAvatar: d.ownerAvatar || null,
              logoUrl: d.logoUrl || null,
              backcoverUrl: d.backcoverUrl || null,
              name: d.name || 'Company',
              category: d.category || 'Services',
              description: d.description || '',
              openTimes: d.openTimes || '',
              contact: d.contact || '',
              email: d.email || '',
              website: d.website || '',
              acceptsReservations: d.acceptsReservations !== false,
              lat: d.lat,
              lng: d.lng,
              locationName: d.locationName || `${d.lat.toFixed(4)}, ${d.lng.toFixed(4)}`,
              createdAt: d.createdAt || Date.now(),
              updatedAt: d.updatedAt || Date.now(),
            });
          }
        });
        loaded.sort((a, b) => b.createdAt - a.createdAt);
        setCompaniesList(loaded);
      },
      () => {}
    );

    return () => unsubscribe();
  }, [isAuthenticated, currentUser]);

  // Real-time synchronization of Company Page Reservations (User's bookings & Owner's incoming reservations)
  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      setMyCompanyReservations([]);
      setOwnerCompanyReservations([]);
      return;
    }

    const unsubMyRes = onSnapshot(
      query(collection(db, 'companyReservations'), where('userId', '==', currentUser.uid)),
      (snapshot) => {
        const list: CompanyReservation[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as CompanyReservation);
        });
        list.sort((a, b) => b.createdAt - a.createdAt);
        setMyCompanyReservations(list);
      },
      () => {}
    );

    const unsubOwnerRes = onSnapshot(
      query(collection(db, 'companyReservations'), where('companyOwnerId', '==', currentUser.uid)),
      (snapshot) => {
        const list: CompanyReservation[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as CompanyReservation);
        });
        list.sort((a, b) => b.createdAt - a.createdAt);
        setOwnerCompanyReservations(list);
      },
      () => {}
    );

    return () => {
      unsubMyRes();
      unsubOwnerRes();
    };
  }, [isAuthenticated, currentUser]);

  // Real-time synchronization of gig applications (submitted by user or received by gig owner)
  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      setMyGigApplications([]);
      setOwnerGigApplications([]);
      return;
    }

    const unsubMyApps = onSnapshot(
      query(collection(db, 'gigApplications'), where('applicantId', '==', currentUser.uid)),
      (snapshot) => {
        const list: GigApplication[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as GigApplication);
        });
        list.sort((a, b) => b.createdAt - a.createdAt);
        setMyGigApplications(list);
      },
      () => {}
    );

    const unsubOwnerApps = onSnapshot(
      query(collection(db, 'gigApplications'), where('gigOwnerId', '==', currentUser.uid)),
      (snapshot) => {
        const list: GigApplication[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as GigApplication);
        });
        list.sort((a, b) => b.createdAt - a.createdAt);
        setOwnerGigApplications(list);
      },
      () => {}
    );

    return () => {
      unsubMyApps();
      unsubOwnerApps();
    };
  }, [isAuthenticated, currentUser]);

  // Real-time synchronization of outgoing & incoming Hires
  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      setOutgoingHires([]);
      setIncomingHires([]);
      return;
    }

    const processHireSnapshots = (items: HireRecord[]) => {
      items.forEach((h) => {
        const prevStatus = prevHireStatusRef.current[h.id];
        if (prevStatus === 'pending' && h.status === 'accepted') {
          setActiveTab('gigs');
        }
        if ((prevStatus === 'pending' || prevStatus === 'accepted') && h.status === 'cancelled') {
          setCancelledNoticeHire(h);
        }
        prevHireStatusRef.current[h.id] = h.status;
      });
    };

    const unsubOut = onSnapshot(
      query(collection(db, 'hires'), where('userId', '==', currentUser.uid)),
      (snapshot) => {
        const loaded: HireRecord[] = [];
        snapshot.forEach((docSnap) => {
          loaded.push(docSnap.data() as HireRecord);
        });
        loaded.sort((a, b) => b.createdAt - a.createdAt);
        processHireSnapshots(loaded);
        setOutgoingHires(loaded);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, `hires?userId=${currentUser.uid}`);
        } catch {
          // ignore
        }
      }
    );

    const unsubIn = onSnapshot(
      query(collection(db, 'hires'), where('seekerId', '==', currentUser.uid)),
      (snapshot) => {
        const loaded: HireRecord[] = [];
        snapshot.forEach((docSnap) => {
          loaded.push(docSnap.data() as HireRecord);
        });
        loaded.sort((a, b) => b.createdAt - a.createdAt);
        processHireSnapshots(loaded);
        setIncomingHires(loaded);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, `hires?seekerId=${currentUser.uid}`);
        } catch {
          // ignore
        }
      }
    );

    return () => {
      unsubOut();
      unsubIn();
    };
  }, [isAuthenticated, currentUser]);

  // Real-time sync of own ReferralLink doc (e.g. if Main Tenant updates our max signups)
  useEffect(() => {
    if (!isAuthenticated || !currentUser || !myReferralCode) return;

    const unsubscribe = onSnapshot(
      doc(db, 'referralLinks', myReferralCode),
      (snap) => {
        if (snap.exists()) {
          const md = snap.data();
          const resolvedMaxComp =
            typeof md.maxCompanySignups === 'number'
              ? md.maxCompanySignups
              : isMainTenant
              ? 0
              : DEFAULT_REFERRAL_TENANT_COMPANY_LIMIT;
          const loadedCfg: TenantOfferConfig = {
            tenantFee: typeof md.tenantFee === 'number' ? md.tenantFee : 299.99,
            userFee: typeof md.userFee === 'number' ? md.userFee : 29.99,
            companyFee: typeof md.companyFee === 'number' ? md.companyFee : 199.99,
            trialDays: typeof md.trialDays === 'number' ? md.trialDays : 0,
            companyTrialDays: typeof md.companyTrialDays === 'number' ? md.companyTrialDays : 0,
            maxTenantSignups: typeof md.maxTenantSignups === 'number' ? md.maxTenantSignups : 0,
            maxUserSignups: typeof md.maxUserSignups === 'number' ? md.maxUserSignups : 0,
            maxCompanySignups: resolvedMaxComp,
            currentTenantSignups: typeof md.currentTenantSignups === 'number' ? md.currentTenantSignups : 0,
            currentUserSignups: typeof md.currentUserSignups === 'number' ? md.currentUserSignups : 0,
            currentCompanySignups: typeof md.currentCompanySignups === 'number' ? md.currentCompanySignups : 0,
            bankName: typeof md.bankName === 'string' ? md.bankName : '',
            bankAccountHolder: typeof md.bankAccountHolder === 'string' ? md.bankAccountHolder : '',
            bankAccountNumber: typeof md.bankAccountNumber === 'string' ? md.bankAccountNumber : '',
            bankBranchCode: typeof md.bankBranchCode === 'string' ? md.bankBranchCode : '',
            bankReferenceNote: typeof md.bankReferenceNote === 'string' ? md.bankReferenceNote : '',
            approvalHoursEnabled: typeof md.approvalHoursEnabled === 'boolean' ? md.approvalHoursEnabled : false,
            approvalHoursStart: typeof md.approvalHoursStart === 'string' ? md.approvalHoursStart : '08:00',
            approvalHoursEnd: typeof md.approvalHoursEnd === 'string' ? md.approvalHoursEnd : '17:00',
            approvalWorkingDays: typeof md.approvalWorkingDays === 'string' ? md.approvalWorkingDays : '1,2,3,4,5',
          };
          setMyTenantConfig(loadedCfg);
          setDraftTenantFee(String(loadedCfg.tenantFee));
          setDraftUserFee(String(loadedCfg.userFee));
          setDraftCompanyFee(String(loadedCfg.companyFee));
          setDraftTrialDays(String(loadedCfg.trialDays));
          setDraftCompanyTrialDays(String(loadedCfg.companyTrialDays));
          setDraftMaxTenantSignups(String(loadedCfg.maxTenantSignups));
          setDraftMaxUserSignups(String(loadedCfg.maxUserSignups));
          setDraftMaxCompanySignups(String(loadedCfg.maxCompanySignups));
          setDraftBankName(loadedCfg.bankName);
          setDraftBankAccountHolder(loadedCfg.bankAccountHolder);
          setDraftBankAccountNumber(loadedCfg.bankAccountNumber);
          setDraftBankBranchCode(loadedCfg.bankBranchCode);
          setDraftBankReferenceNote(loadedCfg.bankReferenceNote);
          setDraftApprovalHoursEnabled(loadedCfg.approvalHoursEnabled);
          setDraftApprovalHoursStart(loadedCfg.approvalHoursStart);
          setDraftApprovalHoursEnd(loadedCfg.approvalHoursEnd);
          setDraftApprovalWorkingDays(loadedCfg.approvalWorkingDays);
        }
      },
      () => {}
    );

    return () => unsubscribe();
  }, [isAuthenticated, currentUser, myReferralCode, isMainTenant]);

  // Main Tenant real-time list of Referral Tenants to manage their Tenant/User/Company Sub signup limits
  useEffect(() => {
    if (!isAuthenticated || !currentUser || !isMainTenant) {
      setReferralTenants([]);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'referralLinks'),
      (snapshot) => {
        const list: ReferralTenantLink[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.ownerTier === 'tenant' && docSnap.id !== MAIN_TENANT_REF_CODE) {
            list.push({
              code: d.code || docSnap.id,
              ownerUid: d.ownerUid || '',
              ownerTier: d.ownerTier,
              displayName: d.displayName || 'Referral Tenant',
              maxTenantSignups: typeof d.maxTenantSignups === 'number' ? d.maxTenantSignups : 0,
              maxUserSignups: typeof d.maxUserSignups === 'number' ? d.maxUserSignups : 0,
              maxCompanySignups:
                typeof d.maxCompanySignups === 'number'
                  ? d.maxCompanySignups
                  : DEFAULT_REFERRAL_TENANT_COMPANY_LIMIT,
              currentTenantSignups: typeof d.currentTenantSignups === 'number' ? d.currentTenantSignups : 0,
              currentUserSignups: typeof d.currentUserSignups === 'number' ? d.currentUserSignups : 0,
              currentCompanySignups: typeof d.currentCompanySignups === 'number' ? d.currentCompanySignups : 0,
            });
          }
        });
        setReferralTenants(list);
        setReferralTenantDrafts((prev) => {
          const next = { ...prev };
          list.forEach((rt) => {
            if (!next[rt.code]) {
              next[rt.code] = {
                maxTenant: String(rt.maxTenantSignups),
                maxUser: String(rt.maxUserSignups),
                maxCompany: String(rt.maxCompanySignups),
              };
            }
          });
          return next;
        });
      },
      () => {}
    );

    return () => unsubscribe();
  }, [isAuthenticated, currentUser, isMainTenant]);

  // Real-time synchronization of incoming referrals scoped to the active tenant (Main Tenant or Referral Tenant)
  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      seenSubmissionIdsRef.current = new Set();
      submissionsInitializedRef.current = false;
      return;
    }

    // Only Main Tenant and Referral Tenants (Tenant Sub / non-user mode) receive referral submissions
    if (!isMainTenant && chosenSubscription === 'user') {
      setSubmissions([]);
      seenSubmissionIdsRef.current = new Set();
      submissionsInitializedRef.current = false;
      return;
    }

    const tenantSubsQuery = isMainTenant
      ? query(collection(db, 'submissions'), where('targetTenantEmail', '==', MAIN_TENANT_EMAIL))
      : query(collection(db, 'submissions'), where('targetTenantUid', '==', currentUser.uid));

    const unsubscribe = onSnapshot(
      tenantSubsQuery,
      (snapshot) => {
        const loaded: Submission[] = [];
        const currentSubIds = new Set<string>();
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          currentSubIds.add(docSnap.id);
          loaded.push({
            id: docSnap.id,
            userId: data.userId || '',
            userName: data.userName || 'Anonymous',
            userEmail: data.userEmail || '',
            subType: data.subType || 'User Sub (R29.99)',
            feeAmount: typeof data.feeAmount === 'number' ? data.feeAmount : undefined,
            selfie: data.selfie || null,
            idDoc: data.idDoc || null,
            popDoc: data.popDoc || null,
            status: data.status || 'pending',
            submittedAt: data.submittedAt || Date.now(),
            expiresAt: data.expiresAt,
            referrerCode: data.referrerCode || MAIN_TENANT_REF_CODE,
            referrerUid: data.referrerUid || '',
            referrerTier: data.referrerTier || 'main_tenant',
            targetTenantEmail: data.targetTenantEmail || MAIN_TENANT_EMAIL,
            targetTenantUid: data.targetTenantUid || '',
            routingLabel: data.routingLabel,
          });
        });
        if (submissionsInitializedRef.current) {
          let hasNewSubmission = false;
          currentSubIds.forEach((id) => {
            if (!seenSubmissionIdsRef.current.has(id)) {
              hasNewSubmission = true;
            }
          });
          if (hasNewSubmission) {
            playNotificationSound();
          }
        }
        seenSubmissionIdsRef.current = currentSubIds;
        submissionsInitializedRef.current = true;
        loaded.sort((a, b) => b.submittedAt - a.submittedAt);
        setSubmissions(loaded);
      },
      (error) => {
        try {
          handleFirestoreError(
            error,
            OperationType.LIST,
            isMainTenant
              ? `submissions?targetTenantEmail=${MAIN_TENANT_EMAIL}`
              : `submissions?targetTenantUid=${currentUser.uid}`
          );
        } catch {
          setAppNotice('Permission denied loading tenant referrals. Please sign in with a verified Google account.');
        }
      }
    );

    return () => {
      submissionsInitializedRef.current = false;
      unsubscribe();
    };
  }, [isAuthenticated, currentUser, isMainTenant, chosenSubscription]);

  // Real-time synchronization of Feedback (User's own sent items + Main Tenant global inbox)
  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      setFeedbackList([]);
      setMyFeedbackList([]);
      seenFeedbackRepliesRef.current = new Set();
      myFeedbackInitRef.current = false;
      return;
    }

    const unsubMyFeedback = onSnapshot(
      query(collection(db, 'feedback'), where('userId', '==', currentUser.uid)),
      (snapshot) => {
        const list: FeedbackItem[] = [];
        const currentRepliedKeys = new Set<string>();
        let hasNewReply = false;
        snapshot.forEach((docSnap) => {
          const item = docSnap.data() as FeedbackItem;
          list.push(item);
          if (item.replyMessage) {
            const key = `${item.id}:${item.repliedAt || ''}`;
            currentRepliedKeys.add(key);
            if (myFeedbackInitRef.current && !seenFeedbackRepliesRef.current.has(key)) {
              hasNewReply = true;
            }
          }
        });
        if (hasNewReply) {
          playNotificationSound();
        }
        seenFeedbackRepliesRef.current = currentRepliedKeys;
        myFeedbackInitRef.current = true;
        list.sort((a, b) => b.createdAt - a.createdAt);
        setMyFeedbackList(list);
      },
      () => {}
    );

    let unsubAllFeedback: (() => void) | null = null;
    if (isMainTenant) {
      unsubAllFeedback = onSnapshot(
        collection(db, 'feedback'),
        (snapshot) => {
          const list: FeedbackItem[] = [];
          snapshot.forEach((docSnap) => {
            list.push(docSnap.data() as FeedbackItem);
          });
          list.sort((a, b) => b.createdAt - a.createdAt);
          setFeedbackList(list);
        },
        () => {}
      );
    } else {
      setFeedbackList([]);
    }

    return () => {
      unsubMyFeedback();
      myFeedbackInitRef.current = false;
      if (unsubAllFeedback) unsubAllFeedback();
    };
  }, [isAuthenticated, currentUser, isMainTenant]);

  // Mark feedback items as read once Main Tenant opens the User Feedback Inbox
  useEffect(() => {
    if (!feedbackInboxOpen || !isMainTenant || !currentUser) return;
    const unreadItems = feedbackList.filter((fb) => !fb.readByMainTenant);
    if (unreadItems.length === 0) return;

    const now = Date.now();
    unreadItems.forEach((fb) => {
      updateDoc(doc(db, 'feedback', fb.id), {
        readByMainTenant: true,
        readAt: now,
      }).catch(() => {});
    });
  }, [feedbackInboxOpen, isMainTenant, currentUser, feedbackList]);

  const unreadFeedbackCount = feedbackList.filter((fb) => !fb.readByMainTenant).length;

  // Real-time Views & Interests sync + unique view recording when opening a gig post
  useEffect(() => {
    if (!isAuthenticated || !currentUser || !viewingGig) {
      setGigViewsCount(0);
      setGigInterestsCount(0);
      setHasExpressedInterest(false);
      return;
    }

    if (currentUser.uid !== viewingGig.ownerId) {
      setDoc(doc(db, 'gigs', viewingGig.id, 'views', currentUser.uid), {
        gigId: viewingGig.id,
        userId: currentUser.uid,
        createdAt: Date.now(),
      }).catch(() => {});
    }

    const unsubViews = onSnapshot(
      collection(db, 'gigs', viewingGig.id, 'views'),
      (snap) => {
        setGigViewsCount(snap.size);
      },
      () => {}
    );

    const unsubInterests = onSnapshot(
      collection(db, 'gigs', viewingGig.id, 'interests'),
      (snap) => {
        setGigInterestsCount(snap.size);
        setHasExpressedInterest(snap.docs.some((d) => d.id === currentUser.uid));
      },
      () => {}
    );

    return () => {
      unsubViews();
      unsubInterests();
    };
  }, [isAuthenticated, currentUser, viewingGig?.id]);

  // Sync active tenant signup counts into /referralLinks/{myReferralCode} for cap checks
  useEffect(() => {
    if (!isAuthenticated || !currentUser || !myReferralCode) return;
    if (!isMainTenant && chosenSubscription !== 'tenant') return;
    if (
      myTenantConfig.currentTenantSignups === tenantSubTotalSignups &&
      myTenantConfig.currentUserSignups === userSubTotalSignups &&
      myTenantConfig.currentCompanySignups === companySubTotalSignups
    ) {
      return;
    }

    setDoc(
      doc(db, 'referralLinks', myReferralCode),
      {
        code: myReferralCode,
        ownerUid: currentUser.uid,
        ownerTier: isMainTenant ? 'main_tenant' : 'tenant',
        displayName: `${firstName || currentUser.displayName || 'Tenant'} ${lastName || ''}`.trim(),
        currentTenantSignups: tenantSubTotalSignups,
        currentUserSignups: userSubTotalSignups,
        currentCompanySignups: companySubTotalSignups,
        updatedAt: Date.now(),
      },
      { merge: true }
    )
      .then(() => {
        setMyTenantConfig((prev) => ({
          ...prev,
          currentTenantSignups: tenantSubTotalSignups,
          currentUserSignups: userSubTotalSignups,
          currentCompanySignups: companySubTotalSignups,
        }));
      })
      .catch(() => {
        // non-fatal sync
      });
  }, [
    isAuthenticated,
    currentUser,
    myReferralCode,
    isMainTenant,
    chosenSubscription,
    tenantSubTotalSignups,
    userSubTotalSignups,
    companySubTotalSignups,
  ]);

  // Refresh upline tenant offer terms & bank transfer details whenever Upgrade or Onboarding modal opens
  useEffect(() => {
    if ((!upgradeModalOpen && !onboardingModalOpen) || !currentUser) return;
    const routing = resolveReferralRouting(activeReferrer, currentUser.uid);
    const codeToRead =
      routing.referrerTier === 'tenant' && routing.referrerCode
        ? routing.referrerCode
        : MAIN_TENANT_REF_CODE;
    getDoc(doc(db, 'referralLinks', codeToRead))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setOfferConfig({
            tenantFee: typeof d.tenantFee === 'number' ? d.tenantFee : 299.99,
            userFee: typeof d.userFee === 'number' ? d.userFee : 29.99,
            companyFee: typeof d.companyFee === 'number' ? d.companyFee : 199.99,
            trialDays: typeof d.trialDays === 'number' ? d.trialDays : 0,
            companyTrialDays: typeof d.companyTrialDays === 'number' ? d.companyTrialDays : 0,
            maxTenantSignups: typeof d.maxTenantSignups === 'number' ? d.maxTenantSignups : 0,
            maxUserSignups: typeof d.maxUserSignups === 'number' ? d.maxUserSignups : 0,
            maxCompanySignups:
              typeof d.maxCompanySignups === 'number'
                ? d.maxCompanySignups
                : routing.referrerTier === 'tenant'
                ? DEFAULT_REFERRAL_TENANT_COMPANY_LIMIT
                : 0,
            currentTenantSignups: typeof d.currentTenantSignups === 'number' ? d.currentTenantSignups : 0,
            currentUserSignups: typeof d.currentUserSignups === 'number' ? d.currentUserSignups : 0,
            currentCompanySignups: typeof d.currentCompanySignups === 'number' ? d.currentCompanySignups : 0,
            bankName: typeof d.bankName === 'string' ? d.bankName : '',
            bankAccountHolder: typeof d.bankAccountHolder === 'string' ? d.bankAccountHolder : '',
            bankAccountNumber: typeof d.bankAccountNumber === 'string' ? d.bankAccountNumber : '',
            bankBranchCode: typeof d.bankBranchCode === 'string' ? d.bankBranchCode : '',
            bankReferenceNote: typeof d.bankReferenceNote === 'string' ? d.bankReferenceNote : '',
            approvalHoursEnabled: typeof d.approvalHoursEnabled === 'boolean' ? d.approvalHoursEnabled : false,
            approvalHoursStart: typeof d.approvalHoursStart === 'string' ? d.approvalHoursStart : '08:00',
            approvalHoursEnd: typeof d.approvalHoursEnd === 'string' ? d.approvalHoursEnd : '17:00',
            approvalWorkingDays: typeof d.approvalWorkingDays === 'string' ? d.approvalWorkingDays : '1,2,3,4,5',
          });
        }
      })
      .catch(() => {});
  }, [upgradeModalOpen, onboardingModalOpen, currentUser, activeReferrer]);

  useEffect(() => {
    isPickingGigRef.current = isPickingGigLocation;
  }, [isPickingGigLocation]);

  useEffect(() => {
    isPickingCompanyRef.current = isPickingCompanyLocation;
  }, [isPickingCompanyLocation]);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;

    if (!mapInstanceRef.current) {
      const defaultLat = -26.2041; // Johannesburg
      const defaultLng = 28.0473;

      const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([defaultLat, defaultLng], 13);

      const initialLayerUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      const tileLayer = L.tileLayer(initialLayerUrl, {
        maxZoom: 19,
        attribution: ''
      }).addTo(map);

      tileLayerRef.current = tileLayer;
      mapInstanceRef.current = map;
      gigMarkersLayerRef.current = L.layerGroup().addTo(map);
      companyMarkersLayerRef.current = L.layerGroup().addTo(map);
      routeLayerRef.current = L.layerGroup().addTo(map);
      companyRouteLayerRef.current = L.layerGroup().addTo(map);

      // Map click listener for picking exact gig or company location
      map.on('click', async (e: L.LeafletMouseEvent) => {
        if (isPickingCompanyRef.current) {
          const { lat, lng } = e.latlng;
          setIsPickingCompanyLocation(false);
          isPickingCompanyRef.current = false;
          setCompanyLat(lat);
          setCompanyLng(lng);
          setCompanyLocationName(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          setCompanyLocationPicked(true);
          setCompanyFormOpen(true);
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const data = await res.json();
            if (data?.display_name) {
              setCompanyLocationName(data.display_name);
            }
          } catch {
            // keep coordinate fallback
          }
          return;
        }
        if (!isPickingGigRef.current) return;
        const { lat, lng } = e.latlng;
        setIsPickingGigLocation(false);
        isPickingGigRef.current = false;
        setGigLat(lat);
        setGigLng(lng);
        setGigLocationName(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        setGigLocationPicked(true);
        setGigFormOpen(true);
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          const data = await res.json();
          if (data?.display_name) {
            setGigLocationName(data.display_name);
          }
        } catch {
          // keep coordinate fallback
        }
      });

      // Try initial GPS user location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setMyUserCoords({ lat: latitude, lng: longitude });
            map.setView(L.latLng(latitude, longitude), 15);
          },
          () => {},
          { enableHighAccuracy: true, timeout: 8000 }
        );
      }
    }

    return () => {
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.remove();
        userLocationMarkerRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Show user/tenant face selfie on the map at User location
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const userAvatar =
      myAvatarThumb ||
      (currentUser ? seekersList.find((s) => s.uid === currentUser.uid)?.avatar : null) ||
      selfieDataUrl ||
      null;
    const hasValidAvatar = Boolean(userAvatar && userAvatar.startsWith('data:image/'));
    const fullName =
      `${firstName || currentUser?.displayName || 'Your'} ${lastName || (currentUser ? '' : 'Location')}`.trim() ||
      'Your Location';
    const initials = escapeHtml(
      fullName
        .split(' ')
        .map((p) => p[0] || '')
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'ME'
    );
    const roleLabel = isMainTenant
      ? 'Main Tenant'
      : chosenSubscription === 'tenant'
      ? 'Tenant'
      : isAuthenticated
      ? 'You'
      : 'You';

    const avatarInnerHtml = hasValidAvatar
      ? `<img src="${userAvatar}" alt="" class="h-full w-full object-cover" />`
      : `<div class="h-full w-full flex items-center justify-center bg-blue-600 text-white text-[11px] font-black">${initials}</div>`;

    const userSelfieIcon = L.divIcon({
      className: 'custom-user-selfie-marker',
      html: `
        <div class="relative flex flex-col items-center">
          <div class="relative flex items-center justify-center">
            <span class="absolute inline-flex h-14 w-14 animate-ping rounded-full bg-blue-500 opacity-50"></span>
            <div class="relative h-11 w-11 rounded-full overflow-hidden border-[3px] border-white shadow-xl bg-blue-600 ring-2 ring-blue-500">
              ${avatarInnerHtml}
            </div>
          </div>
          <span class="-mt-1.5 px-2 py-0.5 rounded-full bg-slate-900/90 text-white text-[9px] font-bold shadow border border-white whitespace-nowrap">${escapeHtml(roleLabel)}</span>
        </div>
      `,
      iconSize: [56, 60],
      iconAnchor: [28, 30],
    });

    const latLng = L.latLng(myUserCoords.lat, myUserCoords.lng);
    const popupHtml = `<b>${escapeHtml(fullName)}</b><br/><span style="font-size:11px;color:#475569;">${escapeHtml(
      locationInput || 'Current User Location'
    )}</span>`;

    if (userLocationMarkerRef.current) {
      userLocationMarkerRef.current.setLatLng(latLng);
      userLocationMarkerRef.current.setIcon(userSelfieIcon);
      userLocationMarkerRef.current.bindPopup(popupHtml);
    } else {
      userLocationMarkerRef.current = L.marker(latLng, { icon: userSelfieIcon, zIndexOffset: 500 })
        .addTo(map)
        .bindPopup(popupHtml);
    }
  }, [
    myUserCoords.lat,
    myUserCoords.lng,
    myAvatarThumb,
    selfieDataUrl,
    firstName,
    lastName,
    locationInput,
    isAuthenticated,
    chosenSubscription,
    isMainTenant,
    currentUser,
    seekersList,
  ]);

  // Derive active hire (accepted first, then pending)
  const allMyHires = [...outgoingHires, ...incomingHires].sort((a, b) => b.createdAt - a.createdAt);
  const activeAcceptedHire = allMyHires.find((h) => h.status === 'accepted') || null;
  const activePendingIncoming = incomingHires.find((h) => h.status === 'pending') || null;
  const activePendingOutgoing = outgoingHires.find((h) => h.status === 'pending') || null;

  // Render posted GiGs markers on the Leaflet map
  useEffect(() => {
    const layer = gigMarkersLayerRef.current;
    const map = mapInstanceRef.current;
    if (!layer || !map) return;

    layer.clearLayers();
    gigsList.forEach((gig) => {
      const isMine = currentUser?.uid === gig.ownerId;
      const resolvedAvatar =
        gig.ownerAvatar || seekersList.find((s) => s.uid === gig.ownerId)?.avatar || null;
      const hasValidAvatar = Boolean(resolvedAvatar && resolvedAvatar.startsWith('data:image/'));
      const ownerInitials = escapeHtml(
        (gig.ownerName || 'U')
          .split(' ')
          .map((p) => p[0] || '')
          .join('')
          .slice(0, 2)
          .toUpperCase() || 'U'
      );
      const safePay = escapeHtml(gig.pay ? gig.pay : 'GiG');
      const avatarHtml = hasValidAvatar
        ? `<img src="${resolvedAvatar}" alt="" class="h-6 w-6 rounded-full object-cover border border-white shrink-0" />`
        : `<div class="h-6 w-6 rounded-full bg-white/25 text-white text-[9px] font-black flex items-center justify-center shrink-0">${ownerInitials}</div>`;

      const gigIcon = L.divIcon({
        className: 'custom-gig-marker',
        html: `
          <div class="flex flex-col items-center">
            <div class="pl-1 pr-2.5 py-0.5 rounded-full ${
              isMine ? 'bg-emerald-600' : 'bg-amber-500'
            } text-white text-[10px] font-extrabold shadow-lg border-2 border-white whitespace-nowrap flex items-center gap-1.5">
              ${avatarHtml}
              <span>${safePay}</span>
            </div>
            <div class="w-2.5 h-2.5 -mt-1 rotate-45 ${isMine ? 'bg-emerald-600' : 'bg-amber-500'} border-r border-b border-white"></div>
          </div>
        `,
        iconSize: [96, 36],
        iconAnchor: [48, 36],
      });

      const marker = L.marker([gig.lat, gig.lng], { icon: gigIcon }).addTo(layer);
      marker.on('click', () => {
        playClickSound();
        setViewingGig(gig);
        setConfirmDeleteGigId(null);
      });
    });
  }, [gigsList, currentUser, seekersList]);

  // Render added Company Pages markers on the Leaflet map
  useEffect(() => {
    const layer = companyMarkersLayerRef.current;
    const map = mapInstanceRef.current;
    if (!layer || !map) return;

    layer.clearLayers();
    companiesList.forEach((company) => {
      const isMine = currentUser?.uid === company.ownerId;
      const resolvedBadgeImg =
        company.logoUrl ||
        company.ownerAvatar ||
        seekersList.find((s) => s.uid === company.ownerId)?.avatar ||
        null;
      const hasValidBadgeImg = Boolean(resolvedBadgeImg && resolvedBadgeImg.startsWith('data:image/'));
      const safeCompanyName = escapeHtml(
        company.name.length > 18 ? `${company.name.slice(0, 17)}...` : company.name
      );
      const badgeInnerHtml = hasValidBadgeImg
        ? `<img src="${resolvedBadgeImg}" alt="" class="h-6 w-6 rounded-full object-cover border border-white shrink-0" />`
        : `<div class="h-6 w-6 rounded-full bg-white/20 text-white flex items-center justify-center shrink-0"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/></svg></div>`;

      const companyIcon = L.divIcon({
        className: 'custom-company-marker',
        html: `
          <div class="flex flex-col items-center">
            <div class="pl-1 pr-2.5 py-0.5 rounded-full ${
              isMine ? 'bg-indigo-600' : 'bg-violet-600'
            } text-white text-[10px] font-extrabold shadow-lg border-2 border-white whitespace-nowrap flex items-center gap-1.5">
              ${badgeInnerHtml}
              <span>${safeCompanyName}</span>
            </div>
            <div class="w-2.5 h-2.5 -mt-1 rotate-45 ${isMine ? 'bg-indigo-600' : 'bg-violet-600'} border-r border-b border-white"></div>
          </div>
        `,
        iconSize: [120, 36],
        iconAnchor: [60, 36],
      });

      const marker = L.marker([company.lat, company.lng], { icon: companyIcon }).addTo(layer);
      marker.on('click', () => {
        playClickSound();
        setViewingCompany(company);
        setConfirmDeleteCompanyId(null);
        setResFormOpen(false);
      });
    });
  }, [companiesList, currentUser, seekersList]);

  // Real-time chat synchronization when navigating to gig destination
  useEffect(() => {
    if (!isAuthenticated || !currentUser || !activeAcceptedHire) {
      setHireChatMessages([]);
      setHireChatOpen(false);
      seenHireMsgIdsRef.current = new Set();
      hireChatInitRef.current = false;
      return;
    }

    const roleField = activeAcceptedHire.userId === currentUser.uid ? 'userId' : 'seekerId';
    const chatQuery = query(
      collection(db, 'hires', activeAcceptedHire.id, 'messages'),
      where(roleField, '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      chatQuery,
      (snapshot) => {
        const list: HireMessage[] = [];
        const currentIds = new Set<string>();
        let hasIncomingFromOther = false;
        snapshot.forEach((docSnap) => {
          const m = docSnap.data() as HireMessage;
          const mId = m.id || docSnap.id;
          currentIds.add(mId);
          if (hireChatInitRef.current && !seenHireMsgIdsRef.current.has(mId) && m.senderId !== currentUser.uid) {
            hasIncomingFromOther = true;
          }
          list.push({ ...m, id: mId });
        });
        if (hasIncomingFromOther) {
          playNotificationSound();
        }
        seenHireMsgIdsRef.current = currentIds;
        hireChatInitRef.current = true;
        list.sort((a, b) => a.createdAt - b.createdAt);
        setHireChatMessages(list);
      },
      () => {}
    );

    return () => {
      hireChatInitRef.current = false;
      unsubscribe();
    };
  }, [isAuthenticated, currentUser, activeAcceptedHire?.id]);

  // Road navigation route rendering in GiGs when a hire is accepted
  useEffect(() => {
    const routeLayer = routeLayerRef.current;
    const map = mapInstanceRef.current;
    if (!routeLayer || !map) return;

    routeLayer.clearLayers();
    if (!activeAcceptedHire) {
      setRouteStats(null);
      return;
    }

    const { seekerLat, seekerLng, destLat, destLng, seekerName, destAddress } = activeAcceptedHire;

    const seekerIcon = L.divIcon({
      className: 'custom-seeker-nav-marker',
      html: `<div class="h-8 w-8 rounded-full bg-emerald-600 border-2 border-white shadow-xl flex items-center justify-center text-white text-xs font-black">S</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
    const destIcon = L.divIcon({
      className: 'custom-dest-nav-marker',
      html: `<div class="h-8 w-8 rounded-full bg-rose-600 border-2 border-white shadow-xl flex items-center justify-center text-white text-xs font-black">D</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    L.marker([seekerLat, seekerLng], { icon: seekerIcon })
      .addTo(routeLayer)
      .bindPopup(`<b>Seeker:</b> ${seekerName}`);
    L.marker([destLat, destLng], { icon: destIcon })
      .addTo(routeLayer)
      .bindPopup(`<b>Destination:</b> ${destAddress}`);

    let cancelled = false;
    fetch(
      `https://router.project-osrm.org/route/v1/driving/${seekerLng},${seekerLat};${destLng},${destLat}?overview=full&geometries=geojson`
    )
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const route = data?.routes?.[0];
        if (route?.geometry?.coordinates?.length) {
          const latlngs: [number, number][] = route.geometry.coordinates.map(
            (c: [number, number]) => [c[1], c[0]]
          );
          const poly = L.polyline(latlngs, { color: '#2563eb', weight: 5, opacity: 0.9 }).addTo(routeLayer);
          setRouteStats({
            distanceKm: Number(((route.distance || 0) / 1000).toFixed(1)),
            durationMin: Math.max(1, Math.round((route.duration || 0) / 60)),
          });
          if (activeTab === 'gigs') {
            map.fitBounds(poly.getBounds().pad(0.25));
          }
        } else {
          const poly = L.polyline(
            [
              [seekerLat, seekerLng],
              [destLat, destLng],
            ],
            { color: '#2563eb', weight: 4, dashArray: '6, 8' }
          ).addTo(routeLayer);
          if (activeTab === 'gigs') {
            map.fitBounds(poly.getBounds().pad(0.25));
          }
        }
      })
      .catch(() => {
        if (cancelled) return;
        const poly = L.polyline(
          [
            [seekerLat, seekerLng],
            [destLat, destLng],
          ],
          { color: '#2563eb', weight: 4, dashArray: '6, 8' }
        ).addTo(routeLayer);
        if (activeTab === 'gigs') {
          map.fitBounds(poly.getBounds().pad(0.25));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeAcceptedHire, activeTab]);

  // Live GPS updates from Seeker while navigating an accepted hire
  useEffect(() => {
    if (!activeAcceptedHire || !currentUser || activeAcceptedHire.seekerId !== currentUser.uid) return;
    if (!navigator.geolocation) return;

    let lastPush = 0;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastPush < 8000) return;
        lastPush = now;
        updateDoc(doc(db, 'hires', activeAcceptedHire.id), {
          seekerLat: pos.coords.latitude,
          seekerLng: pos.coords.longitude,
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeAcceptedHire?.id, currentUser]);

  const stopLadyVoiceGuidance = () => {
    if (navAudioRef.current) {
      try {
        navAudioRef.current.pause();
        navAudioRef.current.currentTime = 0;
      } catch {
        // ignore audio reset error
      }
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore speech cancel error
      }
    }
  };

  const speakBrowserFemaleFallback = (spokenText: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(spokenText);
      const voices = synth.getVoices();
      const femaleVoice =
        voices.find((v) =>
          /female|samantha|victoria|karen|zira|hazel|serena|libby|sonia|moira|tessa|kate|allison|ava|susan|fiona|google uk english female/i.test(
            v.name
          )
        ) ||
        voices.find((v) => v.lang.startsWith('en') && !/male|david|daniel|mark|alex|george|ryan/i.test(v.name)) ||
        voices.find((v) => v.lang.startsWith('en'));
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }
      utterance.pitch = 1.15;
      utterance.rate = 0.96;
      utterance.volume = 1;
      synth.speak(utterance);
    } catch {
      // ignore synthesis fallback errors
    }
  };

  const speakLadyVoice = async (spokenText: string) => {
    if (companyVoiceMutedRef.current) return;
    stopLadyVoiceGuidance();
    try {
      const response = await fetch('/api/tts-company-nav', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: spokenText }),
      });
      if (!response.ok) {
        speakBrowserFemaleFallback(spokenText);
        return;
      }
      const data = await response.json();
      if (companyVoiceMutedRef.current) return;
      if (data?.audioBase64) {
        const audio = navAudioRef.current || new Audio();
        navAudioRef.current = audio;
        audio.src = `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`;
        await audio.play().catch(() => {
          speakBrowserFemaleFallback(spokenText);
        });
        return;
      }
      speakBrowserFemaleFallback(spokenText);
    } catch {
      speakBrowserFemaleFallback(spokenText);
    }
  };

  const handleStartNavigateToCompany = (company: CompanyPost) => {
    setViewingCompany(null);
    setCompanyGadgetOpen(false);
    setMapToolsMenuOpen(false);
    setActiveTab('gigs');
    announcedArrivalCompanyIdRef.current = null;
    setCompanyNavInstruction(`Heading towards ${company.name}`);
    setNavigatingCompany(company);

    if (!navAudioRef.current) {
      navAudioRef.current = new Audio();
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setMyUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }
    void speakLadyVoice(`Navigating you to ${company.name}.`);
  };

  // Render driving route to selected Company Page & keep live GPS updated
  useEffect(() => {
    const companyRouteLayer = companyRouteLayerRef.current;
    const map = mapInstanceRef.current;
    if (!companyRouteLayer || !map) return;

    companyRouteLayer.clearLayers();
    if (!navigatingCompany) {
      setCompanyRouteStats(null);
      setCompanyNavInstruction('');
      return;
    }

    const startLat = myUserCoords.lat;
    const startLng = myUserCoords.lng;
    const destLat = navigatingCompany.lat;
    const destLng = navigatingCompany.lng;

    const companyDestIcon = L.divIcon({
      className: 'custom-company-nav-dest',
      html: `<div class="h-8 w-8 rounded-full bg-indigo-600 border-2 border-white shadow-xl flex items-center justify-center text-white text-xs font-black">B</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
    L.marker([destLat, destLng], { icon: companyDestIcon })
      .addTo(companyRouteLayer)
      .bindPopup(`<b>${escapeHtml(navigatingCompany.name)}</b>`);

    let cancelled = false;
    fetch(
      `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true`
    )
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const route = data?.routes?.[0];
        if (route?.geometry?.coordinates?.length) {
          const latlngs: [number, number][] = route.geometry.coordinates.map(
            (c: [number, number]) => [c[1], c[0]]
          );
          const poly = L.polyline(latlngs, { color: '#4f46e5', weight: 5, opacity: 0.92 }).addTo(companyRouteLayer);
          const distKm = Number(((route.distance || 0) / 1000).toFixed(1));
          const durMin = Math.max(1, Math.round((route.duration || 0) / 60));
          setCompanyRouteStats({ distanceKm: distKm, durationMin: durMin });
          const steps = route?.legs?.[0]?.steps || [];
          const firstStreet = steps[0]?.name ? ` via ${steps[0].name}` : '';
          const stepText = `${distKm} km away (${durMin} min drive)${firstStreet}`;
          setCompanyNavInstruction(stepText);
          if (activeTab === 'gigs') {
            map.fitBounds(poly.getBounds().pad(0.25));
          }
        } else {
          const poly = L.polyline(
            [
              [startLat, startLng],
              [destLat, destLng],
            ],
            { color: '#4f46e5', weight: 4, dashArray: '6, 8' }
          ).addTo(companyRouteLayer);
          if (activeTab === 'gigs') {
            map.fitBounds(poly.getBounds().pad(0.25));
          }
        }
      })
      .catch(() => {
        if (cancelled) return;
        const poly = L.polyline(
          [
            [startLat, startLng],
            [destLat, destLng],
          ],
          { color: '#4f46e5', weight: 4, dashArray: '6, 8' }
        ).addTo(companyRouteLayer);
        if (activeTab === 'gigs') {
          map.fitBounds(poly.getBounds().pad(0.25));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [navigatingCompany, myUserCoords.lat, myUserCoords.lng, activeTab]);

  // Live GPS tracking while navigating to a company
  useEffect(() => {
    if (!navigatingCompany || !navigator.geolocation) return;
    let lastUpdate = 0;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastUpdate < 6000) return;
        lastUpdate = now;
        const { latitude, longitude } = pos.coords;
        setMyUserCoords({ lat: latitude, lng: longitude });

        const dLat = ((navigatingCompany.lat - latitude) * Math.PI) / 180;
        const dLng = ((navigatingCompany.lng - longitude) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((latitude * Math.PI) / 180) *
            Math.cos((navigatingCompany.lat * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
        const metersAway = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        if (metersAway <= 65 && announcedArrivalCompanyIdRef.current !== navigatingCompany.id) {
          announcedArrivalCompanyIdRef.current = navigatingCompany.id;
          setCompanyNavInstruction(`Arrived at ${navigatingCompany.name}`);
          void speakLadyVoice(`You have arrived at ${navigatingCompany.name}.`);
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [navigatingCompany?.id]);



  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  const toggleSatellite = () => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const newIsSatellite = !isSatellite;
    setIsSatellite(newIsSatellite);

    const newLayerUrl = newIsSatellite
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const newTileLayer = L.tileLayer(newLayerUrl, {
      maxZoom: 19,
      attribution: ''
    }).addTo(map);

    tileLayerRef.current = newTileLayer;
  };

  // Main Map Search
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !mapInstanceRef.current) return;

    setIsSearching(true);
    setShowDropdown(false);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
      );
      const data: SearchResult[] = await response.json();
      setIsSearching(false);

      if (data && data.length > 0) {
        setSearchResults(data);
        setShowDropdown(true);
        selectLocation(data[0]);
      } else {
        alert('Location not found.');
      }
    } catch (err) {
      console.error('Search error:', err);
      setIsSearching(false);
    }
  };

  const selectLocation = (result: SearchResult) => {
    if (!mapInstanceRef.current) return;
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    const latLng = L.latLng(lat, lon);

    mapInstanceRef.current.flyTo(latLng, 15, { animate: true, duration: 1.5 });

    if (markerRef.current) {
      markerRef.current.setLatLng(latLng);
      markerRef.current.bindPopup(`<b>${result.display_name}</b>`).openPopup();
    } else {
      markerRef.current = L.marker(latLng)
        .addTo(mapInstanceRef.current)
        .bindPopup(`<b>${result.display_name}</b>`)
        .openPopup();
    }

    setSearchQuery(result.display_name);
    setShowDropdown(false);
  };

  // Location Autocomplete for Profile
  const handleLocationType = async (val: string) => {
    setLocationInput(val);
    if (val.length < 3) {
      setLocationSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}`);
      const data: SearchResult[] = await res.json();
      setLocationSuggestions(data.slice(0, 5));
    } catch (e) {
      console.error(e);
    }
  };

  const autoDetectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        setMyUserCoords({ lat: latitude, lng: longitude });
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          if (data && data.display_name) {
            setLocationInput(data.display_name);
          }
        } catch (e) {
          setLocationInput(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
      });
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(key);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const saveProfileFields = async (
    nextFirst: string,
    nextLast: string,
    nextLocation: string,
    nextContact?: string,
    throwOnError = false
  ) => {
    if (!currentUser) return;
    try {
      const resolvedContact = (nextContact ?? contactInfo).trim().slice(0, 80);
      await updateDoc(doc(db, 'users', currentUser.uid), {
        firstName: nextFirst.slice(0, 120),
        lastName: nextLast.slice(0, 120),
        location: nextLocation.slice(0, 300),
        contactPhone: resolvedContact,
      });
      await syncSeekerDoc(currentUser, {
        displayName: `${nextFirst} ${nextLast}`.trim(),
        location: nextLocation,
        avatar: myAvatarThumb || selfieDataUrl,
        tier: chosenSubscription || 'seeker',
        status: isSubscriptionActive
          ? mySubmissionStatus === 'approved' || isMainTenant
            ? 'approved'
            : mySubmissionStatus === 'pending'
            ? 'pending'
            : 'active'
          : mySubmissionStatus === 'rejected' || mySubmissionStatus === 'frozen'
          ? mySubmissionStatus
          : 'inactive',
      });
    } catch (err) {
      if (throwOnError) {
        try {
          handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`);
        } catch (wrapped) {
          throw wrapped;
        }
      }
      console.warn('Profile update skipped:', err);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    if (!firstName.trim() || !lastName.trim() || !locationInput.trim() || !contactInfo.trim()) {
      setAppNotice('Please fill in all required fields (Name, Surname, Location, and Contact Information).');
      return;
    }
    setIsSavingProfile(true);
    setProfileSuccessMsg(null);
    try {
      await saveProfileFields(
        firstName.trim(),
        lastName.trim(),
        locationInput.trim(),
        contactInfo.trim(),
        true
      );
      setProfileSuccessMsg('Profile updated successfully!');
      setTimeout(() => setProfileSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Failed to save profile:', err);
      setAppNotice('Unable to save profile right now. Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setAuthError(null);

    if (authTab === 'signup') {
      if (!acceptedTerms) {
        setAuthError('Please accept the Terms and Conditions to sign up.');
        return;
      }
      setIsAuthLoading(true);
      pendingTermsAcceptedAtRef.current = Date.now();
      try {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
        try {
          if (auth.currentUser) await sendEmailVerification(auth.currentUser);
        } catch {
          // non-fatal
        }
        const isMain = email.trim().toLowerCase() === MAIN_TENANT_EMAIL;
        setAuthModalOpen(false);
        setStartupSubChooserDismissed(true);
        setPassword('');
        setActiveTab('gigs');
        pendingAuthSubTierRef.current = null;
        if (!isMain) {
          setCongratsModalOpen(true);
        }
      } catch (createErr: any) {
        pendingTermsAcceptedAtRef.current = null;
        if (createErr?.code === 'auth/email-already-in-use') {
          try {
            const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
            const isMain = email.trim().toLowerCase() === MAIN_TENANT_EMAIL;
            setAuthModalOpen(false);
            setStartupSubChooserDismissed(true);
            setPassword('');
            setActiveTab('gigs');
            pendingAuthSubTierRef.current = null;
            if (!isMain) {
              try {
                const uSnap = await getDoc(doc(db, 'users', cred.user.uid));
                const uData = uSnap.exists() ? uSnap.data() : null;
                const uTier = uData?.subscriptionTier;
                const uStatus = uData?.subscriptionStatus;
                if (!uTier || uTier === 'none' || uStatus === 'rejected') {
                  setUpgradeModalOpen(true);
                }
              } catch {
                // keep directed to GiGs
              }
            }
          } catch {
            setAuthTab('signin');
            setAuthError('This email is already registered. Please enter your password to Sign In.');
          }
        } else {
          setAuthError(createErr?.message || 'Unable to create account. Please check your details or try Continue with Google.');
        }
      } finally {
        setIsAuthLoading(false);
      }
      return;
    }

    setIsAuthLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const isMain = email.trim().toLowerCase() === MAIN_TENANT_EMAIL;
      setAuthModalOpen(false);
      setStartupSubChooserDismissed(true);
      setPassword('');
      setActiveTab('gigs');
      pendingAuthSubTierRef.current = null;
      if (!isMain) {
        try {
          const uSnap = await getDoc(doc(db, 'users', cred.user.uid));
          const uData = uSnap.exists() ? uSnap.data() : null;
          const uTier = uData?.subscriptionTier;
          const uStatus = uData?.subscriptionStatus;
          if (!uTier || uTier === 'none' || uStatus === 'rejected') {
            setUpgradeModalOpen(true);
          }
        } catch {
          // keep directed to GiGs
        }
      }
    } catch {
      setAuthError('Incorrect email or password. New referral or new user? Switch to Sign Up and accept the Terms & Conditions.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    if (authTab === 'signup' && !acceptedTerms) {
      setAuthError('Please accept the Terms and Conditions before signing up with Google.');
      return;
    }
    setIsAuthLoading(true);
    if (authTab === 'signup') {
      pendingTermsAcceptedAtRef.current = Date.now();
    }
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const signedEmail = (result.user.email || '').trim().toLowerCase();
      const isMain = signedEmail === MAIN_TENANT_EMAIL;
      setAuthModalOpen(false);
      setStartupSubChooserDismissed(true);
      setActiveTab('gigs');
      pendingAuthSubTierRef.current = null;
      if (!isMain) {
        try {
          const uSnap = await getDocFromServer(doc(db, 'users', result.user.uid));
          const uData = uSnap.exists() ? uSnap.data() : null;
          const uTier = uData?.subscriptionTier;
          const uStatus = uData?.subscriptionStatus;
          const isNewOrUnsubscribed = !uData || !uTier || uTier === 'none';
          if (authTab === 'signup' && isNewOrUnsubscribed) {
            setCongratsModalOpen(true);
          } else if (isNewOrUnsubscribed || uStatus === 'rejected') {
            setUpgradeModalOpen(true);
          }
        } catch {
          if (authTab === 'signup') {
            setCongratsModalOpen(true);
          } else {
            setUpgradeModalOpen(true);
          }
        }
      }
    } catch (err: any) {
      pendingTermsAcceptedAtRef.current = null;
      setAuthError(err?.message || 'Google sign-in was cancelled or blocked.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await fbSignOut(auth);
    } catch (err) {
      console.error('Sign out error:', err);
    }
    setCurrentUser(null);
    setIsAuthenticated(false);
    setUserProfileLoaded(false);
    setIsMainTenant(false);
    setMyReferralCode('');
    setActiveTab('gigs');
    setStartupSubChooserDismissed(false);
    setChosenSubscription(null);
    setSubmissions([]);
    setTenantMenuOpen(false);
    setTenantMenuSection('fees');
    setCompanyGadgetOpen(false);
    setNavigatingCompany(null);
    stopLadyVoiceGuidance();
    setFirstName('');
    setLastName('');
    setLocationInput('');
    setContactInfo('');
    setProfileSuccessMsg(null);
    setAppNotice(null);
    setAcceptedTerms(false);
    setTermsDetailsOpen(false);
    setCongratsModalOpen(false);
    setUpgradeModalOpen(false);
    setOnboardingModalOpen(false);
    setStartupIntentOpen(false);
    setStartupIntentChoice(null);
    setHasCompletedStartupIntent(true);
    setAuthError(null);
    setAuthTab('signup');
    setAuthModalOpen(true);
  };

  const handleSelectSubTier = async (tier: SubTierOption, overrideUser?: FirebaseUser | null) => {
    const activeUser = overrideUser || currentUser;
    if (!activeUser) {
      pendingAuthSubTierRef.current = tier;
      setUpgradeModalOpen(false);
      setStartupSubChooserDismissed(true);
      setAuthModalOpen(true);
      return;
    }
    const nextChosen = getSubCategory(tier);
    if (isSubscriptionLocked && nextChosen !== chosenSubscription) {
      setAppNotice('You cannot switch subscriptions while your current subscription is active. You can choose again when it ends.');
      return;
    }
    if (
      isSubscriptionLocked &&
      nextChosen === chosenSubscription &&
      (mySubmissionStatus !== 'none' || hasActiveTrial)
    ) {
      setUpgradeModalOpen(false);
      setAppNotice('Your current subscription is already active. You can choose a new plan once it ends.');
      return;
    }
    if (
      nextChosen === 'tenant' &&
      offerConfig.maxTenantSignups > 0 &&
      offerConfig.currentTenantSignups >= offerConfig.maxTenantSignups
    ) {
      setAppNotice('Tenant Sub signups limit has been reached for this tenant.');
      return;
    }
    if (
      nextChosen === 'user' &&
      offerConfig.maxUserSignups > 0 &&
      offerConfig.currentUserSignups >= offerConfig.maxUserSignups
    ) {
      setAppNotice('User Sub signups limit has been reached for this tenant.');
      return;
    }
    if (
      nextChosen === 'company' &&
      offerConfig.maxCompanySignups > 0 &&
      offerConfig.currentCompanySignups >= offerConfig.maxCompanySignups
    ) {
      setAppNotice('Company Sub signups limit has been reached for this tenant.');
      return;
    }

    setSelectedSubTier(tier);
    setChosenSubscription(nextChosen);
    setActiveTab('gigs');

    try {
      await updateDoc(doc(db, 'users', activeUser.uid), {
        subscriptionTier: nextChosen,
      });
      if (myReferralCode && !isMainTenant) {
        await syncReferralLinkDoc(
          activeUser,
          myReferralCode,
          nextChosen === 'tenant' ? 'tenant' : 'user',
          `${firstName || activeUser.displayName || 'Member'} ${lastName || ''}`.trim()
        );
      }
      if (activeReferrer) {
        const routing = resolveReferralRouting(activeReferrer, activeUser.uid);
        await ensureSignupReferralSubmission(
          activeUser,
          routing,
          tier,
          `${firstName || activeUser.displayName || ''} ${lastName || ''}`.trim() || undefined
        );
      }
    } catch (err) {
      console.warn('Tier sync:', err);
    }

    setUpgradeModalOpen(false);
    setStartupSubChooserDismissed(true);
    setOnboardingModalOpen(true);
    setSelfieCaptured(false);
    setSelfieDataUrl(null);
    setIdUploaded(false);
    setIdDocFile(null);
    setPopUploaded(false);
    setPopDocFile(null);
  };

  const handleStartFreeTrial = async () => {
    if (!currentUser || !selectedSubTier || myTrialEndsAt) return;
    const nextChosen = getSubCategory(selectedSubTier);
    const applicableTrialDays = nextChosen === 'company' ? offerConfig.companyTrialDays : offerConfig.trialDays;
    if (applicableTrialDays <= 0) return;
    setIsStartingTrial(true);
    setAppNotice(null);
    const startedAt = Date.now();
    const endsAt = startedAt + applicableTrialDays * 24 * 60 * 60 * 1000;
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        subscriptionTier: nextChosen,
        trialStartedAt: startedAt,
        trialEndsAt: endsAt,
      });
      setMyTrialEndsAt(endsAt);
      setChosenSubscription(nextChosen);
      setOnboardingModalOpen(false);
      await syncSeekerDoc(currentUser, {
        displayName: `${firstName || currentUser.displayName || 'Member'} ${lastName || ''}`.trim(),
        location: locationInput,
        avatar: myAvatarThumb,
        tier: nextChosen,
        status: 'active',
      });
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`);
      } catch {
        setAppNotice('Could not activate free trial. Please make sure your upline tenant has enabled trial days.');
      }
    } finally {
      setIsStartingTrial(false);
    }
  };

  const handleSaveTenantConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !myReferralCode) return;
    const parsedTenantFee = Math.max(0, Math.min(1000000, parseFloat(draftTenantFee) || 0));
    const parsedUserFee = Math.max(0, Math.min(1000000, parseFloat(draftUserFee) || 0));
    const parsedCompanyFee = Math.max(0, Math.min(1000000, parseFloat(draftCompanyFee) || 0));
    const parsedTrialDays = Math.max(0, Math.min(365, Math.floor(Number(draftTrialDays) || 0)));
    const parsedCompanyTrialDays = Math.max(0, Math.min(365, Math.floor(Number(draftCompanyTrialDays) || 0)));
    const parsedMaxTenant = Math.max(0, Math.min(1000000, Math.floor(Number(draftMaxTenantSignups) || 0)));
    const parsedMaxUser = Math.max(0, Math.min(1000000, Math.floor(Number(draftMaxUserSignups) || 0)));
    const parsedMaxCompany = Math.max(0, Math.min(1000000, Math.floor(Number(draftMaxCompanySignups) || 0)));
    const cleanBankName = draftBankName.trim().slice(0, 120);
    const cleanBankHolder = draftBankAccountHolder.trim().slice(0, 160);
    const cleanBankNumber = draftBankAccountNumber.trim().slice(0, 60);
    const cleanBankBranch = draftBankBranchCode.trim().slice(0, 40);
    const cleanBankRefNote = draftBankReferenceNote.trim().slice(0, 200);

    setIsSavingTenantConfig(true);
    setTenantConfigSavedMsg(null);
    try {
      const updatedCfg: TenantOfferConfig = {
        tenantFee: Number(parsedTenantFee.toFixed(2)),
        userFee: Number(parsedUserFee.toFixed(2)),
        companyFee: Number(parsedCompanyFee.toFixed(2)),
        trialDays: parsedTrialDays,
        companyTrialDays: parsedCompanyTrialDays,
        maxTenantSignups: isMainTenant ? parsedMaxTenant : myTenantConfig.maxTenantSignups,
        maxUserSignups: isMainTenant ? parsedMaxUser : myTenantConfig.maxUserSignups,
        maxCompanySignups: isMainTenant
          ? parsedMaxCompany
          : myTenantConfig.maxCompanySignups,
        currentTenantSignups: tenantSubTotalSignups,
        currentUserSignups: userSubTotalSignups,
        currentCompanySignups: companySubTotalSignups,
        bankName: cleanBankName,
        bankAccountHolder: cleanBankHolder,
        bankAccountNumber: cleanBankNumber,
        bankBranchCode: cleanBankBranch,
        bankReferenceNote: cleanBankRefNote,
        approvalHoursEnabled: draftApprovalHoursEnabled,
        approvalHoursStart: /^\d:\d\d$/.test(draftApprovalHoursStart.trim()) ? `0${draftApprovalHoursStart.trim()}` : (draftApprovalHoursStart.trim() || '08:00'),
        approvalHoursEnd: /^\d:\d\d$/.test(draftApprovalHoursEnd.trim()) ? `0${draftApprovalHoursEnd.trim()}` : (draftApprovalHoursEnd.trim() || '17:00'),
        approvalWorkingDays: (draftApprovalWorkingDays || '').trim(),
      };
      const payload: Record<string, unknown> = {
        code: myReferralCode,
        ownerUid: currentUser.uid,
        ownerTier: isMainTenant ? 'main_tenant' : 'tenant',
        displayName: `${firstName || currentUser.displayName || 'Tenant'} ${lastName || ''}`.trim(),
        tenantFee: updatedCfg.tenantFee,
        userFee: updatedCfg.userFee,
        companyFee: updatedCfg.companyFee,
        trialDays: updatedCfg.trialDays,
        companyTrialDays: updatedCfg.companyTrialDays,
        bankName: cleanBankName,
        bankAccountHolder: cleanBankHolder,
        bankAccountNumber: cleanBankNumber,
        bankBranchCode: cleanBankBranch,
        bankReferenceNote: cleanBankRefNote,
        approvalHoursEnabled: updatedCfg.approvalHoursEnabled,
        approvalHoursStart: updatedCfg.approvalHoursStart,
        approvalHoursEnd: updatedCfg.approvalHoursEnd,
        approvalWorkingDays: updatedCfg.approvalWorkingDays,
        updatedAt: Date.now(),
      };
      if (isMainTenant) {
        payload.maxTenantSignups = updatedCfg.maxTenantSignups;
        payload.maxUserSignups = updatedCfg.maxUserSignups;
        payload.maxCompanySignups = updatedCfg.maxCompanySignups;
        payload.currentTenantSignups = updatedCfg.currentTenantSignups;
        payload.currentUserSignups = updatedCfg.currentUserSignups;
        payload.currentCompanySignups = updatedCfg.currentCompanySignups;
      }
      await setDoc(
        doc(db, 'referralLinks', myReferralCode),
        payload,
        { merge: true }
      );
      setMyTenantConfig(updatedCfg);
      if (isMainTenant) {
        setOfferConfig(updatedCfg);
      }
      setDraftTenantFee(String(updatedCfg.tenantFee));
      setDraftUserFee(String(updatedCfg.userFee));
      setDraftCompanyFee(String(updatedCfg.companyFee));
      setDraftTrialDays(String(updatedCfg.trialDays));
      setDraftCompanyTrialDays(String(updatedCfg.companyTrialDays));
      setDraftMaxTenantSignups(String(updatedCfg.maxTenantSignups));
      setDraftMaxUserSignups(String(updatedCfg.maxUserSignups));
      setDraftMaxCompanySignups(String(updatedCfg.maxCompanySignups));
      setDraftBankName(updatedCfg.bankName);
      setDraftBankAccountHolder(updatedCfg.bankAccountHolder);
      setDraftBankAccountNumber(updatedCfg.bankAccountNumber);
      setDraftBankBranchCode(updatedCfg.bankBranchCode);
      setDraftBankReferenceNote(updatedCfg.bankReferenceNote);
      setDraftApprovalHoursEnabled(updatedCfg.approvalHoursEnabled);
      setDraftApprovalHoursStart(updatedCfg.approvalHoursStart);
      setDraftApprovalHoursEnd(updatedCfg.approvalHoursEnd);
      setDraftApprovalWorkingDays(updatedCfg.approvalWorkingDays);
      setTenantConfigSavedMsg('Settings saved');
      setTimeout(() => setTenantConfigSavedMsg(null), 2500);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `referralLinks/${myReferralCode}`);
      } catch {
        setAppNotice('Unable to save tenant settings. Ensure your account is verified.');
      }
    } finally {
      setIsSavingTenantConfig(false);
    }
  };

  const handleSaveReferralTenantQuota = async (rt: ReferralTenantLink) => {
    if (!currentUser || !isMainTenant) return;
    const draft = referralTenantDrafts[rt.code];
    const nextMaxTenant = Math.max(0, Math.min(1000000, Math.floor(Number(draft?.maxTenant ?? rt.maxTenantSignups) || 0)));
    const nextMaxUser = Math.max(0, Math.min(1000000, Math.floor(Number(draft?.maxUser ?? rt.maxUserSignups) || 0)));
    const rawMaxCompany =
      draft?.maxCompany !== undefined && draft.maxCompany !== ''
        ? Number(draft.maxCompany)
        : rt.maxCompanySignups;
    const nextMaxCompany = Math.max(
      0,
      Math.min(1000000, Number.isFinite(rawMaxCompany) ? Math.floor(rawMaxCompany) : DEFAULT_REFERRAL_TENANT_COMPANY_LIMIT)
    );

    setSavingReferralCode(rt.code);
    try {
      await updateDoc(doc(db, 'referralLinks', rt.code), {
        maxTenantSignups: nextMaxTenant,
        maxUserSignups: nextMaxUser,
        maxCompanySignups: nextMaxCompany,
        updatedAt: Date.now(),
      });
      setSavedReferralCode(rt.code);
      setTimeout(() => setSavedReferralCode(null), 2000);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `referralLinks/${rt.code}`);
      } catch {
        setAppNotice('Unable to update referral tenant signup limit.');
      }
    } finally {
      setSavingReferralCode(null);
    }
  };

  const handleSaveMyService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !myServiceTitle.trim()) return;
    setIsSavingService(true);
    const center = mapInstanceRef.current?.getCenter();
    const lat = myUserCoords.lat || center?.lat || -26.2041;
    const lng = myUserCoords.lng || center?.lng || 28.0473;
    let resolvedAvatar: string | null =
      myAvatarThumb || seekersList.find((s) => s.uid === currentUser.uid)?.avatar || null;
    if (!resolvedAvatar && selfieDataUrl) {
      resolvedAvatar = await compressImageDataUrl(selfieDataUrl, 240, 0.65);
    }
    if (resolvedAvatar && resolvedAvatar.length > 420000) {
      resolvedAvatar = await compressImageDataUrl(resolvedAvatar, 200, 0.55);
    }
    try {
      await setDoc(
        doc(db, 'seekers', currentUser.uid),
        {
          uid: currentUser.uid,
          displayName: `${firstName || currentUser.displayName || 'Member'} ${lastName || ''}`.trim() || 'Member',
          location: locationInput.slice(0, 280),
          avatar: resolvedAvatar || null,
          tier:
            isMainTenant || chosenSubscription === 'tenant'
              ? 'tenant'
              : chosenSubscription === 'company'
              ? 'company'
              : chosenSubscription === 'user'
              ? 'user'
              : 'seeker',
          status:
            mySubmissionStatus === 'frozen' || mySubmissionStatus === 'rejected'
              ? mySubmissionStatus
              : isMainTenant || mySubmissionStatus === 'approved'
              ? 'approved'
              : 'active',
          serviceTitle: myServiceTitle.trim().slice(0, 120),
          serviceRate: myServiceRate.trim().slice(0, 60),
          serviceDescription: myServiceDescription.trim().slice(0, 400),
          offeringService: myOfferingService,
          lat,
          lng,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
      setServiceEditorOpen(false);
      setSeekerQuery('');
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `seekers/${currentUser.uid}`);
      } catch {
        setAppNotice('Failed to save your service listing.');
      }
    } finally {
      setIsSavingService(false);
    }
  };

  const openHireModal = (seeker: SeekerProfile) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    const center = mapInstanceRef.current?.getCenter();
    const dLat = myUserCoords.lat || center?.lat || -26.2041;
    const dLng = myUserCoords.lng || center?.lng || 28.0473;
    setHireDestLat(dLat);
    setHireDestLng(dLng);
    setHireDestAddress(locationInput || `${dLat.toFixed(5)}, ${dLng.toFixed(5)}`);
    setHireModalSeeker(seeker);
  };

  const handleConfirmHire = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !hireModalSeeker || !hireDestAddress.trim()) return;
    setIsSendingHire(true);
    const hireId = `hire-${Date.now()}`;
    const sLat = typeof hireModalSeeker.lat === 'number' ? hireModalSeeker.lat : hireDestLat + 0.015;
    const sLng = typeof hireModalSeeker.lng === 'number' ? hireModalSeeker.lng : hireDestLng + 0.015;
    const newHire: HireRecord = {
      id: hireId,
      userId: currentUser.uid,
      userName: `${firstName || currentUser.displayName || 'User'} ${lastName || ''}`.trim() || 'User',
      seekerId: hireModalSeeker.uid,
      seekerName: hireModalSeeker.displayName,
      serviceTitle: hireModalSeeker.serviceTitle || 'General Service',
      serviceRate: hireModalSeeker.serviceRate || 'Negotiable',
      seekerLat: sLat,
      seekerLng: sLng,
      destLat: hireDestLat,
      destLng: hireDestLng,
      destAddress: hireDestAddress.trim().slice(0, 280),
      status: 'pending',
      createdAt: Date.now(),
    };
    try {
      await setDoc(doc(db, 'hires', hireId), newHire);
      prevHireStatusRef.current[hireId] = 'pending';
      setHireModalSeeker(null);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, `hires/${hireId}`);
      } catch {
        setAppNotice('Could not send hire request.');
      }
    } finally {
      setIsSendingHire(false);
    }
  };

  const handleAcceptHire = async (hire: HireRecord) => {
    if (!currentUser || hire.seekerId !== currentUser.uid) return;
    const center = mapInstanceRef.current?.getCenter();
    const sLat = myUserCoords.lat || center?.lat || hire.seekerLat;
    const sLng = myUserCoords.lng || center?.lng || hire.seekerLng;
    try {
      await updateDoc(doc(db, 'hires', hire.id), {
        status: 'accepted',
        acceptedAt: Date.now(),
        seekerLat: sLat,
        seekerLng: sLng,
      });
      setActiveTab('gigs');
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `hires/${hire.id}`);
      } catch {
        setAppNotice('Could not accept gig request.');
      }
    }
  };

  const handleCompleteHire = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !ratingModalHire || ratingModalHire.userId !== currentUser.uid) return;
    setIsCompletingHire(true);
    const completedAt = Date.now();
    try {
      await updateDoc(doc(db, 'hires', ratingModalHire.id), {
        status: 'completed',
        rating: ratingValue,
        ratingComment: ratingComment.trim().slice(0, 280),
        completedAt,
      });
      await setDoc(doc(db, 'seekerRatings', ratingModalHire.id), {
        hireId: ratingModalHire.id,
        seekerId: ratingModalHire.seekerId,
        userId: currentUser.uid,
        rating: ratingValue,
        createdAt: completedAt,
      });
      setRatingModalHire(null);
      setRatingComment('');
      setRatingValue(5);
      setActiveTab('seekers');
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `hires/${ratingModalHire.id}`);
      } catch {
        setAppNotice('Unable to complete gig and submit rating.');
      }
    } finally {
      setIsCompletingHire(false);
    }
  };

  const handleCancelHireSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !cancelModalHire || !cancelReasonInput.trim()) return;
    const role: 'user' | 'seeker' = cancelModalHire.userId === currentUser.uid ? 'user' : 'seeker';
    setIsCancellingHire(true);
    try {
      await updateDoc(doc(db, 'hires', cancelModalHire.id), {
        status: 'cancelled',
        cancelReason: cancelReasonInput.trim().slice(0, 280),
        cancelledBy: role,
        cancelledAt: Date.now(),
      });
      setCancelModalHire(null);
      setCancelReasonInput('');
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `hires/${cancelModalHire.id}`);
      } catch {
        setAppNotice('Could not cancel gig.');
      }
    } finally {
      setIsCancellingHire(false);
    }
  };

  const handleGigLocationType = async (val: string) => {
    setGigLocationName(val);
    setGigLocationPicked(false);
    if (val.trim().length < 3) {
      setGigLocationSuggestions([]);
      return;
    }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val.trim())}`
      );
      const data: SearchResult[] = await res.json();
      setGigLocationSuggestions(data.slice(0, 5));
    } catch {
      // ignore suggestion lookup errors
    }
  };

  const handleStartCreateGig = () => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    if (!isMainTenant && !isSubscriptionActive) {
      setAppNotice(
        mySubmissionStatus === 'frozen'
          ? 'Your referral account has been frozen by your tenant.'
          : isSubscriptionEnded
          ? 'Your subscription has ended. Choose a subscription plan to activate again.'
          : 'Your account is inactive. Choose a subscription plan to unlock creating gigs.'
      );
      if (mySubmissionStatus !== 'frozen') {
        setUpgradeModalOpen(true);
      }
      return;
    }
    const center = mapInstanceRef.current?.getCenter();
    const defaultLat = center?.lat || myUserCoords.lat || -26.2041;
    const defaultLng = center?.lng || myUserCoords.lng || 28.0473;
    setEditingGig(null);
    setGigTitle('');
    setGigPay('');
    setGigCategory('General');
    setGigDescription('');
    setGigDate(new Date().toISOString().slice(0, 10));
    setGigTime('');
    setGigLat(defaultLat);
    setGigLng(defaultLng);
    setGigLocationName('');
    setGigLocationSuggestions([]);
    setGigLocationPicked(false);
    setIsPickingGigLocation(false);
    setGigFormOpen(true);
  };

  const handleStartEditGig = (gig: GigPost) => {
    setViewingGig(null);
    setEditingGig(gig);
    setGigTitle(gig.title);
    setGigPay(gig.pay);
    setGigCategory(gig.category || 'General');
    setGigDescription(gig.description);
    setGigDate(gig.gigDate || '');
    setGigTime(gig.gigTime || '');
    setGigLat(gig.lat);
    setGigLng(gig.lng);
    setGigLocationName(gig.locationName);
    setGigLocationSuggestions([]);
    setGigLocationPicked(true);
    setGigFormOpen(true);
  };

  const handleSaveGig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !gigTitle.trim() || !gigDescription.trim() || !gigPay.trim()) return;
    setIsSavingGig(true);
    const now = Date.now();
    const ownerName = `${firstName || currentUser.displayName || 'User'} ${lastName || ''}`.trim() || 'User';

    let finalLat = gigLat;
    let finalLng = gigLng;
    let finalLocName = gigLocationName.trim();

    if (!gigLocationPicked && finalLocName.length >= 2) {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(finalLocName)}`
        );
        const data: SearchResult[] = await res.json();
        if (data && data.length > 0) {
          finalLat = parseFloat(data[0].lat);
          finalLng = parseFloat(data[0].lon);
          finalLocName = data[0].display_name || finalLocName;
        }
      } catch {
        // fallback to existing coordinates
      }
    }
    if (!finalLocName) {
      finalLocName = `${finalLat.toFixed(5)}, ${finalLng.toFixed(5)}`;
    }

    let resolvedOwnerAvatar: string | null =
      myAvatarThumb || seekersList.find((s) => s.uid === currentUser.uid)?.avatar || null;
    if (!resolvedOwnerAvatar && selfieDataUrl) {
      resolvedOwnerAvatar = await compressImageDataUrl(selfieDataUrl, 240, 0.65);
    }
    if (resolvedOwnerAvatar && resolvedOwnerAvatar.length > 420000) {
      resolvedOwnerAvatar = await compressImageDataUrl(resolvedOwnerAvatar, 200, 0.55);
    }

    try {
      if (editingGig) {
        await updateDoc(doc(db, 'gigs', editingGig.id), {
          ownerName,
          ownerAvatar: resolvedOwnerAvatar || editingGig.ownerAvatar || null,
          title: gigTitle.trim().slice(0, 120),
          description: gigDescription.trim().slice(0, 1000),
          pay: gigPay.trim().slice(0, 60),
          category: gigCategory.trim().slice(0, 60) || 'General',
          lat: finalLat,
          lng: finalLng,
          locationName: finalLocName.slice(0, 280),
          gigDate: gigDate.trim().slice(0, 40),
          gigTime: gigTime.trim().slice(0, 40),
          updatedAt: now,
        });
      } else {
        const gigId = `gig-${now}`;
        const newGig: GigPost = {
          id: gigId,
          ownerId: currentUser.uid,
          ownerName,
          ownerAvatar: resolvedOwnerAvatar || null,
          title: gigTitle.trim().slice(0, 120),
          description: gigDescription.trim().slice(0, 1000),
          pay: gigPay.trim().slice(0, 60),
          category: gigCategory.trim().slice(0, 60) || 'General',
          lat: finalLat,
          lng: finalLng,
          locationName: finalLocName.slice(0, 280),
          gigDate: gigDate.trim().slice(0, 40),
          gigTime: gigTime.trim().slice(0, 40),
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(doc(db, 'gigs', gigId), newGig);
      }
      setGigFormOpen(false);
      setEditingGig(null);
      setGigLocationSuggestions([]);
      setActiveTab('gigs');
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([finalLat, finalLng], 16, { animate: true, duration: 1.2 });
      }
    } catch (err) {
      try {
        handleFirestoreError(err, editingGig ? OperationType.UPDATE : OperationType.CREATE, 'gigs');
      } catch {
        setAppNotice('Could not save gig post.');
      }
    } finally {
      setIsSavingGig(false);
    }
  };

  const handleCompanyLocationType = async (val: string) => {
    setCompanyLocationName(val);
    setCompanyLocationPicked(false);
    if (val.trim().length < 3) {
      setCompanyLocationSuggestions([]);
      return;
    }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val.trim())}`
      );
      const data: SearchResult[] = await res.json();
      setCompanyLocationSuggestions(data.slice(0, 5));
    } catch {
      // ignore suggestion lookup errors
    }
  };

  const handleCompanyLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = reader.result as string;
      const compressed = await compressImageDataUrl(raw, 220, 0.62);
      setCompanyLogoUrl(compressed);
    };
    reader.readAsDataURL(file);
  };

  const handleCompanyBackcoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = reader.result as string;
      const compressed = await compressImageDataUrl(raw, 720, 0.6);
      setCompanyBackcoverUrl(compressed);
    };
    reader.readAsDataURL(file);
  };

  const handleStartAddCompany = () => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    if (!isMainTenant && !isSubscriptionActive) {
      setAppNotice(
        mySubmissionStatus === 'frozen'
          ? 'Your referral account has been frozen by your tenant.'
          : isSubscriptionEnded
          ? 'Your subscription has ended. Choose a subscription plan to activate again.'
          : 'Your account is inactive. Choose a subscription plan to unlock adding companies.'
      );
      if (mySubmissionStatus !== 'frozen') {
        setUpgradeModalOpen(true);
      }
      return;
    }
    const center = mapInstanceRef.current?.getCenter();
    const defaultLat = center?.lat || myUserCoords.lat || -26.2041;
    const defaultLng = center?.lng || myUserCoords.lng || 28.0473;
    setEditingCompany(null);
    setCompanyName('');
    setCompanyCategory('Services');
    setCompanyOpenTimes('');
    setCompanyContact('');
    setCompanyEmail('');
    setCompanyWebsite('');
    setCompanyLogoUrl(null);
    setCompanyBackcoverUrl(null);
    setCompanyAcceptsReservations(true);
    setCompanyDescription('');
    setCompanyLat(defaultLat);
    setCompanyLng(defaultLng);
    setCompanyLocationName('');
    setCompanyLocationSuggestions([]);
    setCompanyLocationPicked(false);
    setIsPickingCompanyLocation(false);
    setCompanyFormOpen(true);
  };

  const handleStartEditCompany = (company: CompanyPost) => {
    setViewingCompany(null);
    setEditingCompany(company);
    setCompanyName(company.name);
    setCompanyCategory(company.category || 'Services');
    setCompanyOpenTimes(company.openTimes || '');
    setCompanyContact(company.contact || '');
    setCompanyEmail(company.email || '');
    setCompanyWebsite(company.website || '');
    setCompanyLogoUrl(company.logoUrl || null);
    setCompanyBackcoverUrl(company.backcoverUrl || null);
    setCompanyAcceptsReservations(company.acceptsReservations !== false);
    setCompanyDescription(company.description);
    setCompanyLat(company.lat);
    setCompanyLng(company.lng);
    setCompanyLocationName(company.locationName);
    setCompanyLocationSuggestions([]);
    setCompanyLocationPicked(true);
    setCompanyFormOpen(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !companyName.trim() || !companyDescription.trim()) return;
    setIsSavingCompany(true);
    const now = Date.now();
    const ownerName = `${firstName || currentUser.displayName || 'Owner'} ${lastName || ''}`.trim() || 'Owner';

    let finalLat = companyLat;
    let finalLng = companyLng;
    let finalLocName = companyLocationName.trim();

    if (!companyLocationPicked && finalLocName.length >= 2) {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(finalLocName)}`
        );
        const data: SearchResult[] = await res.json();
        if (data && data.length > 0) {
          finalLat = parseFloat(data[0].lat);
          finalLng = parseFloat(data[0].lon);
          finalLocName = data[0].display_name || finalLocName;
        }
      } catch {
        // fallback to existing coordinates
      }
    }
    if (!finalLocName) {
      finalLocName = `${finalLat.toFixed(5)}, ${finalLng.toFixed(5)}`;
    }

    let resolvedOwnerAvatar: string | null =
      myAvatarThumb || seekersList.find((s) => s.uid === currentUser.uid)?.avatar || null;
    if (!resolvedOwnerAvatar && selfieDataUrl) {
      resolvedOwnerAvatar = await compressImageDataUrl(selfieDataUrl, 180, 0.55);
    }
    if (resolvedOwnerAvatar && resolvedOwnerAvatar.length > 180000) {
      resolvedOwnerAvatar = await compressImageDataUrl(resolvedOwnerAvatar, 160, 0.5);
    }

    let safeLogo = companyLogoUrl;
    if (safeLogo && safeLogo.length > 350000) {
      safeLogo = await compressImageDataUrl(safeLogo, 180, 0.5);
    }
    let safeBackcover = companyBackcoverUrl;
    if (safeBackcover && safeBackcover.length > 480000) {
      safeBackcover = await compressImageDataUrl(safeBackcover, 560, 0.5);
    }

    try {
      if (editingCompany) {
        await updateDoc(doc(db, 'companies', editingCompany.id), {
          ownerName: ownerName.slice(0, 160),
          ownerAvatar: resolvedOwnerAvatar || editingCompany.ownerAvatar || null,
          logoUrl: safeLogo || null,
          backcoverUrl: safeBackcover || null,
          name: companyName.trim().slice(0, 120),
          category: companyCategory.trim().slice(0, 60) || 'Services',
          description: companyDescription.trim().slice(0, 1000),
          openTimes: companyOpenTimes.trim().slice(0, 200),
          contact: companyContact.trim().slice(0, 160),
          email: companyEmail.trim().slice(0, 200),
          website: companyWebsite.trim().slice(0, 300),
          acceptsReservations: companyAcceptsReservations,
          lat: finalLat,
          lng: finalLng,
          locationName: finalLocName.slice(0, 280),
          updatedAt: now,
        });
      } else {
        const companyId = `co-${now}`;
        const newCompany: CompanyPost = {
          id: companyId,
          ownerId: currentUser.uid,
          ownerName: ownerName.slice(0, 160),
          ownerAvatar: resolvedOwnerAvatar || null,
          logoUrl: safeLogo || null,
          backcoverUrl: safeBackcover || null,
          name: companyName.trim().slice(0, 120),
          category: companyCategory.trim().slice(0, 60) || 'Services',
          description: companyDescription.trim().slice(0, 1000),
          openTimes: companyOpenTimes.trim().slice(0, 200),
          contact: companyContact.trim().slice(0, 160),
          email: companyEmail.trim().slice(0, 200),
          website: companyWebsite.trim().slice(0, 300),
          acceptsReservations: companyAcceptsReservations,
          lat: finalLat,
          lng: finalLng,
          locationName: finalLocName.slice(0, 280),
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(doc(db, 'companies', companyId), newCompany);
      }
      setCompanyFormOpen(false);
      setEditingCompany(null);
      setCompanyLocationSuggestions([]);
      setActiveTab('gigs');
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([finalLat, finalLng], 16, { animate: true, duration: 1.2 });
      }
    } catch (err) {
      try {
        handleFirestoreError(err, editingCompany ? OperationType.UPDATE : OperationType.CREATE, 'companies');
      } catch {
        setAppNotice('Could not save company page.');
      }
    } finally {
      setIsSavingCompany(false);
    }
  };

  const handleDeleteCompany = async (companyId: string) => {
    if (!currentUser) return;
    setIsDeletingCompany(true);
    try {
      await deleteDoc(doc(db, 'companies', companyId));
      setViewingCompany(null);
      setConfirmDeleteCompanyId(null);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.DELETE, `companies/${companyId}`);
      } catch {
        setAppNotice('Could not delete company page.');
      }
    } finally {
      setIsDeletingCompany(false);
    }
  };

  const handleSubmitReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !viewingCompany || !resDate.trim() || !resTime.trim()) return;
    setIsSubmittingRes(true);
    const now = Date.now();
    const resId = `res-${now}-${currentUser.uid.slice(0, 6)}`;
    const userName =
      `${firstName || currentUser.displayName || currentUser.email?.split('@')[0] || 'Guest'} ${lastName || ''}`.trim() ||
      'Guest';
    const payload: CompanyReservation = {
      id: resId,
      companyId: viewingCompany.id,
      companyName: viewingCompany.name.slice(0, 120),
      companyOwnerId: viewingCompany.ownerId,
      userId: currentUser.uid,
      userName: userName.slice(0, 160),
      userEmail: (currentUser.email || '').slice(0, 320),
      reservationDate: resDate.trim().slice(0, 40),
      reservationTime: resTime.trim().slice(0, 40),
      guests: (resGuests.trim() || '1').slice(0, 40),
      contactPhone: resPhone.trim().slice(0, 80),
      notes: resNotes.trim().slice(0, 400),
      status: 'pending',
      createdAt: now,
    };
    try {
      await setDoc(doc(db, 'companyReservations', resId), payload);
      setResFormOpen(false);
      setResDate('');
      setResTime('');
      setResGuests('1');
      setResPhone('');
      setResNotes('');
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, `companyReservations/${resId}`);
      } catch {
        setAppNotice('Could not submit reservation. Please try again.');
      }
    } finally {
      setIsSubmittingRes(false);
    }
  };

  const handleUpdateReservationStatus = async (
    reservationId: string,
    status: 'confirmed' | 'declined' | 'cancelled'
  ) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'companyReservations', reservationId), { status });
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `companyReservations/${reservationId}`);
      } catch {
        setAppNotice('Could not update reservation status.');
      }
    }
  };

  const handleToggleGigInterest = async (gig: GigPost) => {
    if (!currentUser || isTogglingInterest) return;
    setIsTogglingInterest(true);
    const interestRef = doc(db, 'gigs', gig.id, 'interests', currentUser.uid);
    try {
      if (hasExpressedInterest) {
        await deleteDoc(interestRef);
      } else {
        await setDoc(interestRef, {
          gigId: gig.id,
          userId: currentUser.uid,
          createdAt: Date.now(),
        });
      }
    } catch {
      setAppNotice('Could not update gig interest.');
    } finally {
      setIsTogglingInterest(false);
    }
  };

  const handleSendHireMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !activeAcceptedHire || !hireChatInput.trim()) return;
    setIsSendingHireChat(true);
    const msgId = `msg-${Date.now()}-${currentUser.uid.slice(0, 6)}`;
    const senderName =
      `${firstName || currentUser.displayName || currentUser.email?.split('@')[0] || 'Member'} ${lastName || ''}`.trim() ||
      'Member';
    const senderAvatar =
      myAvatarThumb || seekersList.find((s) => s.uid === currentUser.uid)?.avatar || null;
    const payload: HireMessage = {
      id: msgId,
      hireId: activeAcceptedHire.id,
      userId: activeAcceptedHire.userId,
      seekerId: activeAcceptedHire.seekerId,
      senderId: currentUser.uid,
      senderName: senderName.slice(0, 160),
      senderAvatar: senderAvatar && senderAvatar.length <= 420000 ? senderAvatar : null,
      text: hireChatInput.trim().slice(0, 1000),
      createdAt: Date.now(),
    };
    try {
      await setDoc(doc(db, 'hires', activeAcceptedHire.id, 'messages', msgId), payload);
      setHireChatInput('');
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, `hires/${activeAcceptedHire.id}/messages/${msgId}`);
      } catch {
        setAppNotice('Could not send message. Please try again.');
      }
    } finally {
      setIsSendingHireChat(false);
    }
  };

  const handleApplyToGig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !viewingGig) return;
    if (isMainTenant || chosenSubscription === 'tenant') {
      setAppNotice('Tenants cannot apply to gig posts.');
      return;
    }
    if (!isSubscriptionActive) {
      setAppNotice('Your account must be active (User Sub) to apply to gig posts.');
      return;
    }
    setIsApplyingGig(true);
    const appId = `app-${Date.now()}`;
    const applicantName = `${firstName || currentUser.displayName || 'User'} ${lastName || ''}`.trim() || 'User';
    const newApp: GigApplication = {
      id: appId,
      gigId: viewingGig.id,
      gigTitle: viewingGig.title.slice(0, 120),
      gigOwnerId: viewingGig.ownerId,
      applicantId: currentUser.uid,
      applicantName: applicantName.slice(0, 160),
      message: gigApplyMessage.trim().slice(0, 400),
      status: 'pending',
      createdAt: Date.now(),
    };
    try {
      await setDoc(doc(db, 'gigApplications', appId), newApp);
      if (!hasExpressedInterest) {
        setDoc(doc(db, 'gigs', viewingGig.id, 'interests', currentUser.uid), {
          gigId: viewingGig.id,
          userId: currentUser.uid,
          createdAt: Date.now(),
        }).catch(() => {});
      }
      setGigApplyMessage('');
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, `gigApplications/${appId}`);
      } catch {
        setAppNotice('Unable to submit gig application.');
      }
    } finally {
      setIsApplyingGig(false);
    }
  };

  const handleUpdateGigApplicationStatus = async (appId: string, status: 'accepted' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'gigApplications', appId), { status });
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `gigApplications/${appId}`);
      } catch {
        setAppNotice('Could not update application status.');
      }
    }
  };

  const handleDeleteGig = async (gigId: string) => {
    if (!currentUser) return;
    setIsDeletingGig(true);
    try {
      await deleteDoc(doc(db, 'gigs', gigId));
      setViewingGig(null);
      setConfirmDeleteGigId(null);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.DELETE, `gigs/${gigId}`);
      } catch {
        setAppNotice('Could not delete gig post.');
      }
    } finally {
      setIsDeletingGig(false);
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !feedbackInput.trim()) return;
    setIsSendingFeedback(true);
    setFeedbackSentSuccess(false);
    const fbId = `fb-${Date.now()}-${currentUser.uid.slice(0, 6)}`;
    const senderName =
      `${firstName || currentUser.displayName || currentUser.email?.split('@')[0] || 'App User'} ${lastName || ''}`.trim() ||
      'App User';
    const senderTier: FeedbackItem['userTier'] = isMainTenant
      ? 'main_tenant'
      : chosenSubscription === 'tenant'
      ? 'tenant'
      : chosenSubscription === 'company'
      ? 'company'
      : chosenSubscription === 'user'
      ? 'user'
      : 'none';
    let senderAvatar: string | null =
      myAvatarThumb || seekersList.find((s) => s.uid === currentUser.uid)?.avatar || null;
    if (!senderAvatar && selfieDataUrl) {
      senderAvatar = await compressImageDataUrl(selfieDataUrl, 240, 0.65);
    }
    const senderStatus = isMainTenant
      ? 'approved'
      : mySubmissionStatus !== 'none'
      ? mySubmissionStatus
      : isSubscriptionActive
      ? 'active'
      : 'inactive';
    const payload: FeedbackItem = {
      id: fbId,
      userId: currentUser.uid,
      userName: senderName.slice(0, 160),
      userEmail: (currentUser.email || email || '').slice(0, 320),
      userTier: senderTier,
      userAvatar: senderAvatar && senderAvatar.length <= 420000 ? senderAvatar : null,
      userLocation: locationInput.trim().slice(0, 280),
      userReferralCode: (myReferralCode || '').slice(0, 128),
      userStatus: senderStatus.slice(0, 40),
      message: feedbackInput.trim().slice(0, 1000),
      createdAt: Date.now(),
      readByMainTenant: false,
    };
    try {
      await setDoc(doc(db, 'feedback', fbId), payload);
      setFeedbackInput('');
      setFeedbackSentSuccess(true);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, `feedback/${fbId}`);
      } catch {
        setAppNotice('Unable to send feedback. Please try again.');
      }
    } finally {
      setIsSendingFeedback(false);
    }
  };

  const handleReplyToFeedback = async (fb: FeedbackItem) => {
    if (!currentUser || !isMainTenant || !currentUser.emailVerified || !replyDraft.trim()) return;
    setIsSendingReply(true);
    const replierName =
      `${firstName || currentUser.displayName || 'Main'} ${lastName || 'Tenant'}`.trim() || 'Main Tenant';
    let replierAvatar: string | null =
      myAvatarThumb || seekersList.find((s) => s.uid === currentUser.uid)?.avatar || null;
    if (!replierAvatar && selfieDataUrl) {
      replierAvatar = await compressImageDataUrl(selfieDataUrl, 240, 0.65);
    }
    const now = Date.now();
    try {
      await updateDoc(doc(db, 'feedback', fb.id), {
        readByMainTenant: true,
        readAt: fb.readAt || now,
        replyMessage: replyDraft.trim().slice(0, 1000),
        repliedAt: now,
        repliedByUid: currentUser.uid,
        repliedByName: replierName.slice(0, 160),
        repliedByAvatar: replierAvatar && replierAvatar.length <= 420000 ? replierAvatar : null,
      });
      setReplyingFeedbackId(null);
      setReplyDraft('');
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `feedback/${fb.id}`);
      } catch {
        setAppNotice('Unable to send reply. Please verify your Main Tenant sign-in.');
      }
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleFinalSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubTier || !currentUser) return;

    setIsSubmittingReview(true);
    setAppNotice(null);
    const subId = `sub-${Date.now()}`;
    const routing = resolveReferralRouting(activeReferrer, currentUser.uid);
    const nextChosen = getSubCategory(selectedSubTier);
    const configuredFee =
      nextChosen === 'tenant'
        ? offerConfig.tenantFee
        : nextChosen === 'company'
        ? offerConfig.companyFee
        : offerConfig.userFee;

    const newSub: Submission = {
      id: subId,
      userId: currentUser.uid,
      userName: `${firstName || currentUser.displayName || 'Referral User'} ${lastName || ''}`.trim() || 'New Subscriber',
      userEmail: currentUser.email || email || '',
      subType: selectedSubTier,
      feeAmount: configuredFee,
      selfie: selfieDataUrl,
      idDoc: idDocFile,
      popDoc: popDocFile,
      status: 'pending',
      submittedAt: Date.now(),
      referrerCode: routing.referrerCode,
      referrerUid: routing.referrerUid,
      referrerTier: routing.referrerTier,
      targetTenantEmail: routing.targetTenantEmail,
      targetTenantUid: routing.targetTenantUid,
      routingLabel: routing.routingLabel,
    };

    try {
      await setDoc(doc(db, 'submissions', subId), newSub);
      await updateDoc(doc(db, 'users', currentUser.uid), {
        subscriptionTier: nextChosen,
        subscriptionStatus: 'pending',
        uplineTenantEmail: routing.targetTenantEmail,
        uplineTenantUid: routing.targetTenantUid,
      });
      if (myReferralCode && !isMainTenant) {
        await syncReferralLinkDoc(
          currentUser,
          myReferralCode,
          nextChosen === 'tenant' ? 'tenant' : 'user',
          newSub.userName
        );
      }
      const thumbAvatar = selfieDataUrl ? await compressImageDataUrl(selfieDataUrl, 240, 0.65) : null;
      if (thumbAvatar) setMyAvatarThumb(thumbAvatar);
      await syncSeekerDoc(currentUser, {
        displayName: newSub.userName,
        location: locationInput,
        avatar: thumbAvatar,
        tier: nextChosen,
        status: 'pending',
      });
      setMySubmissionStatus('pending');
      setOnboardingModalOpen(false);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, `submissions/${subId}`);
      } catch {
        setAppNotice('Could not submit verification. Please ensure file sizes are under 650 KB and try again.');
      }
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const canDecideSubmission = (sub: Submission): boolean => {
    if (!currentUser) return false;
    if (isMainTenant) {
      return (
        (sub.targetTenantEmail || '').toLowerCase() === MAIN_TENANT_EMAIL &&
        sub.userId !== currentUser.uid
      );
    }
    return sub.targetTenantUid === currentUser.uid && sub.userId !== currentUser.uid;
  };

  const getSubscriptionExpiryState = (sub: Submission) => {
    if (sub.status !== 'approved' || typeof sub.expiresAt !== 'number') {
      return {
        isExpiringSoon: false,
        isExpired: false,
        isRedAlert: false,
        daysLeft: null as number | null,
        badgeLabel: null as string | null,
      };
    }
    const remainingMs = sub.expiresAt - nowMs;
    const isExpired = remainingMs <= 0;
    const isExpiringSoon = !isExpired && remainingMs <= EXPIRY_WARNING_MS;
    const isRedAlert = isExpired || isExpiringSoon;
    const daysLeft = isExpired ? 0 : Math.max(1, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
    const badgeLabel = isExpired
      ? 'SUB ENDED'
      : isExpiringSoon
      ? `ENDS IN ${daysLeft}D`
      : `${daysLeft}d left`;
    return {
      isExpiringSoon,
      isExpired,
      isRedAlert,
      daysLeft,
      badgeLabel,
    };
  };

  const handleApproveSubmission = async (sub: Submission) => {
    if (!canDecideSubmission(sub)) {
      setAppNotice('Only the Referrer Tenant can decide on this referral subscription.');
      return;
    }

    // Check working hours restriction if configured by referrer tenant
    const referrerCode = sub.referrerCode || (isMainTenant ? MAIN_TENANT_REF_CODE : myReferralCode);
    try {
      const linkSnap = await getDoc(doc(db, 'referralLinks', referrerCode));
      if (linkSnap.exists()) {
        const ld = linkSnap.data();
        if (ld.approvalHoursEnabled === true) {
          const now = new Date();
          const currentDay = now.getDay(); // 0 = Sun..6 = Sat
          const allowedDaysStr = typeof ld.approvalWorkingDays === 'string' ? ld.approvalWorkingDays : '1,2,3,4,5';
          const allowedDays = allowedDaysStr.split(',').map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));
          if (allowedDays.length > 0 && !allowedDays.includes(currentDay)) {
            setAppNotice(`Approval is restricted to working days (${allowedDaysStr.replace(/0/g, 'Sun').replace(/1/g, 'Mon').replace(/2/g, 'Tue').replace(/3/g, 'Wed').replace(/4/g, 'Thu').replace(/5/g, 'Fri').replace(/6/g, 'Sat')}). Today is outside working days.`);
            return;
          }
          const startStr = typeof ld.approvalHoursStart === 'string' ? ld.approvalHoursStart : '08:00';
          const endStr = typeof ld.approvalHoursEnd === 'string' ? ld.approvalHoursEnd : '17:00';
          const [startH, startM] = startStr.split(':').map((n) => parseInt(n, 10));
          const [endH, endM] = endStr.split(':').map((n) => parseInt(n, 10));
          const currentH = now.getHours();
          const currentM = now.getMinutes();
          const currentTotalM = currentH * 60 + currentM;
          const startTotalM = (isNaN(startH) ? 8 : startH) * 60 + (isNaN(startM) ? 0 : startM);
          const endTotalM = (isNaN(endH) ? 17 : endH) * 60 + (isNaN(endM) ? 0 : endM);
          if (currentTotalM < startTotalM || currentTotalM > endTotalM) {
            setAppNotice(`Approval is restricted to working hours between ${startStr} and ${endStr}. Current time is outside working hours.`);
            return;
          }
        }
      }
    } catch {
      // proceed if check fails
    }

    const subCat = getSubCategory(sub.subType);
    const extraTrialDays = Math.max(
      0,
      subCat === 'company' ? myTenantConfig.companyTrialDays || 0 : myTenantConfig.trialDays || 0
    );
    const expiry = Date.now() + 1000 * 60 * 60 * 24 * (30 + extraTrialDays); // 30 days + referral trial days
    try {
      await updateDoc(doc(db, 'submissions', sub.id), {
        status: 'approved',
        expiresAt: expiry
      });
      setSubmissions((prev) =>
        prev.map((s) => (s.id === sub.id ? { ...s, status: 'approved', expiresAt: expiry } : s))
      );
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `submissions/${sub.id}`);
      } catch {
        setAppNotice('Failed to approve submission. Verify your tenant session permissions.');
      }
    }
  };

  const handleExtendSubmission = async (sub: Submission, days = 30) => {
    if (!canDecideSubmission(sub)) {
      setAppNotice('Only the Referrer Tenant can decide on this referral subscription.');
      return;
    }
    const baseMs = sub.expiresAt && sub.expiresAt > Date.now() ? sub.expiresAt : Date.now();
    const nextExpiry = baseMs + 1000 * 60 * 60 * 24 * days;
    try {
      await updateDoc(doc(db, 'submissions', sub.id), {
        status: 'approved',
        expiresAt: nextExpiry,
      });
      setSubmissions((prev) =>
        prev.map((s) => (s.id === sub.id ? { ...s, status: 'approved', expiresAt: nextExpiry } : s))
      );
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `submissions/${sub.id}`);
      } catch {
        setAppNotice('Failed to extend referral subscription. Verify your tenant session permissions.');
      }
    }
  };

  const handleRejectSubmission = async (sub: Submission) => {
    if (!canDecideSubmission(sub)) {
      setAppNotice('Only the Referrer Tenant can decide on this referral subscription.');
      return;
    }
    try {
      await updateDoc(doc(db, 'submissions', sub.id), {
        status: 'rejected'
      });
      setSubmissions((prev) =>
        prev.map((s) => (s.id === sub.id ? { ...s, status: 'rejected' } : s))
      );
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `submissions/${sub.id}`);
      } catch {
        setAppNotice('Failed to reject submission. Verify your tenant session permissions.');
      }
    }
  };

  const handleFreezeSubmission = async (sub: Submission) => {
    if (!canDecideSubmission(sub)) {
      setAppNotice('Only the Referrer Tenant can decide on this referral subscription.');
      return;
    }
    try {
      await updateDoc(doc(db, 'submissions', sub.id), {
        status: 'frozen'
      });
      setSubmissions((prev) =>
        prev.map((s) => (s.id === sub.id ? { ...s, status: 'frozen' } : s))
      );
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `submissions/${sub.id}`);
      } catch {
        setAppNotice('Failed to freeze referral account. Verify your tenant session permissions.');
      }
    }
  };

  const handleUnfreezeSubmission = async (sub: Submission) => {
    if (!canDecideSubmission(sub)) {
      setAppNotice('Only the Referrer Tenant can decide on this referral subscription.');
      return;
    }
    const expiry =
      sub.expiresAt && sub.expiresAt > Date.now()
        ? sub.expiresAt
        : Date.now() + 1000 * 60 * 60 * 24 * 30;
    try {
      await updateDoc(doc(db, 'submissions', sub.id), {
        status: 'approved',
        expiresAt: expiry,
      });
      setSubmissions((prev) =>
        prev.map((s) => (s.id === sub.id ? { ...s, status: 'approved', expiresAt: expiry } : s))
      );
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `submissions/${sub.id}`);
      } catch {
        setAppNotice('Failed to unfreeze referral account. Verify your tenant session permissions.');
      }
    }
  };

  // Blurry Light Grey Background Wallpaper with 3D Random Gadget Tools Floating Around
  const FloatingToolsWallpaper = ({ opacity = 'opacity-90' }: { opacity?: string; isDark?: boolean } = {}) => {
    const gadgetNodes: Array<{
      Icon: React.ComponentType<{ className?: string }>;
      pos: string;
      anim: string;
      color: string;
      size: string;
      box: string;
    }> = [
      { Icon: Wrench, pos: 'top-[6%] left-[5%]', anim: 'animate-float-3d-a', color: 'text-blue-600', size: 'h-7 w-7 sm:h-8 sm:w-8', box: 'p-3.5 sm:p-4' },
      { Icon: Hammer, pos: 'bottom-[14%] right-[7%]', anim: 'animate-float-3d-b', color: 'text-indigo-600', size: 'h-8 w-8 sm:h-9 sm:w-9', box: 'p-4' },
      { Icon: Smartphone, pos: 'top-[14%] right-[12%]', anim: 'animate-float-3d-c', color: 'text-sky-600', size: 'h-7 w-7', box: 'p-3.5' },
      { Icon: Compass, pos: 'bottom-[24%] left-[8%]', anim: 'animate-float-3d-b', color: 'text-rose-600', size: 'h-7 w-7', box: 'p-3.5' },
      { Icon: Camera, pos: 'top-[28%] left-[18%]', anim: 'animate-float-3d-c', color: 'text-violet-600', size: 'h-6 w-6', box: 'p-3' },
      { Icon: Satellite, pos: 'top-[22%] right-[26%]', anim: 'animate-float-3d-a', color: 'text-cyan-600', size: 'h-7 w-7', box: 'p-3.5' },
      { Icon: Zap, pos: 'bottom-[34%] right-[19%]', anim: 'animate-float-3d-a', color: 'text-amber-600', size: 'h-6 w-6', box: 'p-3' },
      { Icon: Settings, pos: 'top-[48%] left-[4%]', anim: 'animate-float-3d-c', color: 'text-slate-700', size: 'h-7 w-7', box: 'p-3.5' },
      { Icon: Briefcase, pos: 'bottom-[9%] left-[24%]', anim: 'animate-float-3d-a', color: 'text-emerald-600', size: 'h-7 w-7', box: 'p-3.5' },
      { Icon: Navigation, pos: 'top-[44%] right-[5%]', anim: 'animate-float-3d-b', color: 'text-teal-600', size: 'h-7 w-7', box: 'p-3.5' },
      { Icon: MapPin, pos: 'bottom-[44%] left-[28%]', anim: 'animate-float-3d-b', color: 'text-red-500', size: 'h-6 w-6', box: 'p-3' },
      { Icon: Layers, pos: 'top-[10%] left-[42%]', anim: 'animate-float-3d-c', color: 'text-indigo-500', size: 'h-6 w-6', box: 'p-3' },
      { Icon: Globe, pos: 'bottom-[10%] left-[52%]', anim: 'animate-float-3d-c', color: 'text-blue-500', size: 'h-7 w-7', box: 'p-3.5' },
      { Icon: Shield, pos: 'top-[62%] right-[32%]', anim: 'animate-float-3d-a', color: 'text-emerald-700', size: 'h-6 w-6', box: 'p-3' },
      { Icon: Store, pos: 'top-[72%] left-[14%]', anim: 'animate-float-3d-b', color: 'text-orange-600', size: 'h-6 w-6', box: 'p-3' },
      { Icon: Sparkles, pos: 'top-[68%] right-[8%]', anim: 'animate-float-3d-c', color: 'text-amber-500', size: 'h-6 w-6', box: 'p-3' },
    ];

    return (
      <div className={`fixed inset-0 overflow-hidden pointer-events-none select-none blur-[4px] scale-105 ${opacity}`}>
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-white/60 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-slate-400/25 blur-3xl" />
        {gadgetNodes.map(({ Icon, pos, anim, color, size, box }, idx) => (
          <div key={idx} className={`absolute ${pos} ${anim}`}>
            <div
              className={`${box} rounded-2xl bg-gradient-to-br from-white via-gray-100 to-gray-300 border-t border-l border-white/95 border-b-[4px] border-r-[3px] border-b-slate-400/75 border-r-slate-300/80 shadow-[0_14px_26px_-8px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.95)]`}
            >
              <Icon className={`${size} ${color} drop-shadow-[0_2px_3px_rgba(15,23,42,0.18)]`} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="relative h-dvh w-screen overflow-hidden m-0 p-0 font-sans bg-gray-200">
      {/* 5-Second Intro Splash Screen: TimeGiG Displayed Over Light Grey 3D Gadget Tools Wallpaper */}
      {showSplash && (
        <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-gray-100 via-gray-200 to-slate-300 flex flex-col items-center justify-center select-none overflow-hidden animate-in fade-in duration-300">
          <FloatingToolsWallpaper opacity="opacity-95" />
          <div className="relative z-10 flex flex-col items-center justify-center text-center px-6">
            <h1 className="text-6xl sm:text-7xl md:text-8xl font-black tracking-tight text-slate-900 drop-shadow-[0_10px_24px_rgba(15,23,42,0.18)] font-sans">
              TimeGiG
            </h1>
          </div>
        </div>
      )}



      {/* Fullscreen Map */}
      <div ref={mapRef} className="absolute inset-0 h-full w-full z-0" />

      {/* Global Non-Blocking Notice Banner */}
      {appNotice && (
        <div className="fixed top-4 right-4 z-90 max-w-sm rounded-2xl bg-rose-600 text-white px-4 py-3 shadow-2xl border border-rose-500 flex items-start gap-2.5 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="flex-1">{appNotice}</span>
          <button onClick={() => setAppNotice(null)} className="text-white/80 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Referrals Feature View (Search Bar at Top + All Direct & User Sub Referrals) */}
      {activeTab === 'referrals' && (() => {
        const fullSubUserIds = new Set(
          submissions
            .filter((s) => !s.id.startsWith('sub-ref-') || Boolean(s.idDoc || s.popDoc))
            .map((s) => s.userId)
        );
        const visibleSubmissions = submissions.filter(
          (s) => !s.id.startsWith('sub-ref-') || Boolean(s.idDoc || s.popDoc) || !fullSubUserIds.has(s.userId)
        );
        const q = referralQuery.trim().toLowerCase();
        const filteredReferrals = visibleSubmissions.filter((sub) => {
          if (referralStatusFilter !== 'all' && sub.status !== referralStatusFilter) {
            return false;
          }
          if (!q) return true;
          return (
            (sub.userName || '').toLowerCase().includes(q) ||
            (sub.userEmail || '').toLowerCase().includes(q) ||
            (sub.subType || '').toLowerCase().includes(q) ||
            (sub.status || '').toLowerCase().includes(q) ||
            (sub.referrerCode || '').toLowerCase().includes(q) ||
            (sub.routingLabel || '').toLowerCase().includes(q)
          );
        });

        return (
          <div className="fixed inset-0 z-35 bg-gradient-to-br from-gray-100/95 via-gray-200/95 to-slate-300/95 backdrop-blur-2xl flex flex-col text-slate-900 overflow-y-auto pb-28">
            <FloatingToolsWallpaper opacity="opacity-85" />

            {/* Sticky Top Bar + Search Bar */}
            <div className="relative z-10 max-w-3xl mx-auto w-full px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b border-slate-300/80 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20 flex items-center justify-center">
                    <Share2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-slate-900">
                      {isMainTenant ? 'Referrals' : 'Tenant Referrals'}
                    </h2>
                    <p className="text-[11px] text-slate-600">
                      {isMainTenant
                        ? `${visibleSubmissions.length} ${visibleSubmissions.length === 1 ? 'referral' : 'referrals'} (direct & User Sub referrals) • View, approve & reject`
                        : `${visibleSubmissions.length} total ${visibleSubmissions.length === 1 ? 'referral' : 'referrals'} • View, approve & reject`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setActiveTab('gigs');
                  }}
                  className="min-h-[44px] min-w-[44px] p-2.5 rounded-2xl bg-white/90 hover:bg-white text-slate-700 border border-slate-300/80 shadow-sm flex items-center justify-center transition"
                  title="Close to Map"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Search Bar at Top */}
              <div className="relative flex items-center">
                <Search className="absolute left-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={referralQuery}
                  onChange={(e) => setReferralQuery(e.target.value)}
                  placeholder="Search referrals by name, email, tier, status, or code..."
                  className="w-full rounded-2xl bg-white/95 border border-slate-300 py-2.5 pl-10 pr-9 text-xs text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 transition"
                />
                {referralQuery && (
                  <button
                    type="button"
                    onClick={() => setReferralQuery('')}
                    className="absolute right-3 text-slate-500 hover:text-slate-900"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {(
                  [
                    { id: 'all', label: `All (${visibleSubmissions.length})` },
                    { id: 'pending', label: `Pending (${visibleSubmissions.filter((s) => s.status === 'pending').length})` },
                    { id: 'approved', label: `Approved (${visibleSubmissions.filter((s) => s.status === 'approved').length})` },
                    { id: 'rejected', label: `Rejected (${visibleSubmissions.filter((s) => s.status === 'rejected').length})` },
                    { id: 'frozen', label: `Frozen (${visibleSubmissions.filter((s) => s.status === 'frozen').length})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      playClickSound();
                      setReferralStatusFilter(tab.id);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition ${
                      referralStatusFilter === tab.id
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white/85 text-slate-700 border border-slate-300 hover:bg-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Referrals Body */}
            <div className="relative z-10 max-w-3xl mx-auto w-full px-4 sm:px-6 py-4 space-y-3">
              {filteredReferrals.length === 0 ? (
                <div className="rounded-3xl bg-white/95 border border-slate-200 shadow-lg p-8 text-center space-y-3">
                  <Share2 className="h-10 w-10 text-emerald-600 mx-auto" />
                  <h3 className="text-sm font-bold text-slate-900">
                    {visibleSubmissions.length === 0 ? 'No Tenant Referrals Yet' : 'No Matching Referrals Found'}
                  </h3>
                  <p className="text-xs text-slate-600 max-w-md mx-auto">
                    {visibleSubmissions.length === 0
                      ? 'Share your referral link to invite subscribers. All Tenant and User Sub referrals routed to you will appear here for review.'
                      : 'Try clearing your search query or selecting another status filter.'}
                  </p>
                  {visibleSubmissions.length === 0 && myReferralCode && (
                    <button
                      type="button"
                      onClick={() => {
                        const link = `${window.location.origin}?ref=${myReferralCode}`;
                        handleCopy(link, 'referrals-empty-copy');
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>{copiedLink === 'referrals-empty-copy' ? 'Referral Link Copied!' : 'Copy Referral Link'}</span>
                    </button>
                  )}
                </div>
              ) : (
                filteredReferrals.map((sub) => {
                  const expiryInfo = getSubscriptionExpiryState(sub);
                  const canDecide = canDecideSubmission(sub);
                  const subFee =
                    typeof sub.feeAmount === 'number'
                      ? sub.feeAmount
                      : getSubCategory(sub.subType) === 'tenant'
                      ? myTenantConfig.tenantFee
                      : getSubCategory(sub.subType) === 'company'
                      ? myTenantConfig.companyFee
                      : myTenantConfig.userFee;

                  return (
                    <div
                      key={sub.id}
                      className={`rounded-2xl bg-white/95 border p-4 shadow-lg space-y-3 transition ${
                        expiryInfo.isRedAlert ? 'border-rose-400' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() => {
                              playClickSound();
                              setViewingSubmission(sub);
                            }}
                            className="h-12 w-12 rounded-full overflow-hidden bg-slate-100 border-2 border-emerald-500/70 flex items-center justify-center shrink-0 hover:scale-105 transition"
                            title="Inspect Selfie & Documents"
                          >
                            {sub.selfie && sub.selfie.startsWith('data:image') ? (
                              <img src={sub.selfie} alt={sub.userName} className="h-full w-full object-cover" />
                            ) : (
                              <User className="h-5 w-5 text-emerald-600" />
                            )}
                          </button>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-bold text-slate-900 truncate">{sub.userName}</h3>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                  sub.status === 'approved'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : sub.status === 'rejected'
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                    : sub.status === 'frozen'
                                    ? 'bg-sky-100 text-sky-800 border border-sky-200'
                                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {sub.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 truncate">{sub.userEmail || 'No email'}</p>
                            <div className="flex items-center gap-2 flex-wrap mt-1.5 text-[10px] text-slate-700">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-semibold tabular-nums">
                                {sub.subType} • R{subFee.toFixed(2)}
                              </span>
                              {sub.referrerTier === 'user' && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                                  Referred via User Sub
                                </span>
                              )}
                              <span className="text-slate-500">
                                {new Date(sub.submittedAt).toLocaleDateString()}
                              </span>
                              {sub.referrerCode && (
                                <span className="font-mono text-emerald-700 font-semibold">Code: {sub.referrerCode}</span>
                              )}
                            </div>
                            {sub.routingLabel && (
                              <p className="text-[10px] text-slate-500 mt-1">{sub.routingLabel}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {expiryInfo.isRedAlert && (
                        <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-1.5 text-[11px] text-rose-700 font-semibold flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            {expiryInfo.isExpired
                              ? 'Subscription has expired'
                              : `Expires in ${expiryInfo.daysLeft} day${expiryInfo.daysLeft === 1 ? '' : 's'}`}
                          </span>
                        </div>
                      )}

                      {/* Action Buttons: View, Approve, Reject */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            playClickSound();
                            setViewingSubmission(sub);
                          }}
                          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition"
                        >
                          <Eye className="h-3.5 w-3.5 text-sky-600" />
                          <span>View</span>
                        </button>

                        {canDecide && sub.status !== 'approved' && (
                          <button
                            type="button"
                            onClick={() => {
                              playClickSound();
                              handleApproveSubmission(sub);
                            }}
                            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Approve</span>
                          </button>
                        )}

                        {canDecide && sub.status !== 'rejected' && (
                          <button
                            type="button"
                            onClick={() => {
                              playClickSound();
                              handleRejectSubmission(sub);
                            }}
                            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Reject</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })()}

      {/* Seekers Feature View (Search Bar at Top + Seekers Hiring Services to Users) */}
      {activeTab === 'seekers' && (
        <div className="fixed inset-0 z-35 bg-gradient-to-br from-gray-100/95 via-gray-200/95 to-slate-300/95 backdrop-blur-2xl flex flex-col text-slate-900 overflow-y-auto pb-28">
          <FloatingToolsWallpaper opacity="opacity-85" />

          {/* Sticky Top Bar + Search Bar */}
          <div className="relative z-10 max-w-3xl mx-auto w-full px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b border-slate-300/80 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-violet-600 text-white shadow-md shadow-violet-600/20 flex items-center justify-center">
                  <UserSearch className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900">Seekers Services</h2>
                  <p className="text-[11px] text-slate-600">
                    Browse seekers offering services for hire or offer your own service
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    startCamera();
                  }}
                  className="relative h-11 w-11 rounded-full border-2 border-violet-500 bg-white overflow-hidden flex items-center justify-center shadow-sm hover:scale-105 transition shrink-0"
                  title={selfieDataUrl || myAvatarThumb ? 'Update Face Selfie' : 'Take Face Selfie'}
                >
                  {selfieDataUrl || myAvatarThumb || currentUser?.photoURL ? (
                    <img
                      src={selfieDataUrl || myAvatarThumb || currentUser?.photoURL || ''}
                      alt="Your Face Selfie"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Camera className="h-4 w-4 text-violet-600" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setServiceEditorOpen((prev) => !prev);
                  }}
                  className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                    serviceEditorOpen
                      ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25'
                      : 'bg-white/90 hover:bg-white text-violet-700 border border-violet-300 shadow-sm'
                  }`}
                >
                  <Briefcase className="h-3.5 w-3.5" />
                  <span>{myServiceTitle ? 'My Service' : 'Offer Service'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setActiveTab('gigs');
                  }}
                  className="min-h-[44px] min-w-[44px] p-2.5 rounded-2xl bg-white/90 hover:bg-white text-slate-700 border border-slate-300/80 shadow-sm flex items-center justify-center transition"
                  title="Close to Map"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Search Bar at Top */}
            <div className="relative flex items-center">
              <Search className="absolute left-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={seekerQuery}
                onChange={(e) => setSeekerQuery(e.target.value)}
                placeholder="Search seekers by service, skill, name, rate, or location..."
                className="w-full rounded-2xl bg-white/95 border border-slate-300 py-2.5 pl-10 pr-9 text-xs text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition"
              />
              {seekerQuery && (
                <button
                  type="button"
                  onClick={() => setSeekerQuery('')}
                  className="absolute right-3 text-slate-500 hover:text-slate-900"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="relative z-10 max-w-3xl mx-auto w-full px-4 sm:px-6 py-4 space-y-4">
            {/* Collapsible My Service Editor for Seekers Hiring Their Services */}
            {serviceEditorOpen && (
              <form
                onSubmit={handleSaveMyService}
                className="rounded-3xl bg-white/95 border border-violet-200 shadow-xl p-5 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-violet-600" />
                    <span>List Your Service for Hire</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setMyOfferingService((prev) => !prev)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition ${
                      myOfferingService
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-300'
                    }`}
                  >
                    {myOfferingService ? 'Active for Hire' : 'Paused'}
                  </button>
                </div>

                {/* Face Selfie Row in Service Editor */}
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 border border-slate-200 p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-12 w-12 rounded-full overflow-hidden bg-white border-2 border-violet-500 flex items-center justify-center shrink-0">
                      {selfieDataUrl || myAvatarThumb || currentUser?.photoURL ? (
                        <img
                          src={selfieDataUrl || myAvatarThumb || currentUser?.photoURL || ''}
                          alt="Your Face Selfie"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="h-5 w-5 text-violet-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900">Your Face Selfie</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {selfieDataUrl || myAvatarThumb
                          ? 'Displayed on your Seekers card'
                          : 'Take a face selfie so clients recognize you'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      playClickSound();
                      startCamera();
                    }}
                    className="min-h-[40px] px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold flex items-center gap-1.5 shrink-0 transition"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>{selfieDataUrl || myAvatarThumb ? 'Retake' : 'Take Selfie'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Service Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={myServiceTitle}
                      onChange={(e) => setMyServiceTitle(e.target.value)}
                      placeholder="e.g. Plumber, Electrician, Delivery, Cleaner"
                      className="w-full rounded-xl bg-slate-50 border border-slate-300 p-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Service Rate / Price</label>
                    <input
                      type="text"
                      value={myServiceRate}
                      onChange={(e) => setMyServiceRate(e.target.value)}
                      placeholder="e.g. R250/hr or R500 fixed"
                      className="w-full rounded-xl bg-slate-50 border border-slate-300 p-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Service Description</label>
                  <textarea
                    rows={2}
                    value={myServiceDescription}
                    onChange={(e) => setMyServiceDescription(e.target.value)}
                    placeholder="Describe your experience, tools, and availability..."
                    className="w-full rounded-xl bg-slate-50 border border-slate-300 p-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-600"
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setServiceEditorOpen(false)}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingService}
                    className="min-h-[40px] px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isSavingService && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>Save Service Listing</span>
                  </button>
                </div>
              </form>
            )}

            {/* Active / Pending Hire Status Banner */}
            {(incomingHires.some((h) => h.status === 'pending' || h.status === 'accepted') ||
              outgoingHires.some((h) => h.status === 'accepted')) && (
              <div className="space-y-2">
                {incomingHires
                  .filter((h) => h.status === 'pending' || h.status === 'accepted')
                  .map((hire) => (
                    <div
                      key={hire.id}
                      className="rounded-2xl bg-white/95 border border-blue-300 shadow-md p-3.5 flex items-center justify-between gap-3 flex-wrap text-xs"
                    >
                      <div>
                        <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-black uppercase">
                          {hire.status === 'pending' ? 'Hire Request' : 'Active Hire'}
                        </span>
                        <p className="font-bold text-slate-900 mt-1">
                          {hire.userName} • {hire.serviceTitle}
                        </p>
                        <p className="text-[11px] text-slate-600">{hire.destAddress}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {hire.status === 'pending' ? (
                          <button
                            type="button"
                            onClick={() => {
                              playClickSound();
                              handleAcceptHire(hire);
                            }}
                            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition"
                          >
                            Accept &amp; Navigate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              playClickSound();
                              setActiveTab('gigs');
                            }}
                            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition"
                          >
                            Open Live Map
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            playClickSound();
                            setCancelReasonInput('');
                            setCancelModalHire(hire);
                          }}
                          className="min-h-[40px] px-3 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-200 font-bold transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}

                {outgoingHires
                  .filter((h) => h.status === 'accepted')
                  .map((hire) => (
                    <div
                      key={hire.id}
                      className="rounded-2xl bg-white/95 border border-emerald-300 shadow-md p-3.5 flex items-center justify-between gap-3 flex-wrap text-xs"
                    >
                      <div>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-black uppercase">
                          Seeker En Route
                        </span>
                        <p className="font-bold text-slate-900 mt-1">
                          {hire.seekerName} • {hire.serviceTitle}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            playClickSound();
                            setActiveTab('gigs');
                          }}
                          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition"
                        >
                          Track on Map
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            playClickSound();
                            setRatingValue(5);
                            setRatingComment('');
                            setRatingModalHire(hire);
                          }}
                          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition"
                        >
                          Complete &amp; Rate
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Seekers Offering Services List */}
            {(() => {
              const q = seekerQuery.trim().toLowerCase();
              const serviceSeekers = seekersList
                .filter((s) => {
                  if (s.status === 'frozen' || s.status === 'rejected') return false;
                  if (s.offeringService === false) return false;
                  const hasService = Boolean(s.serviceTitle && s.serviceTitle.trim());
                  if (!hasService && !q) {
                    return true;
                  }
                  if (!q) return true;
                  return (
                    (s.displayName || '').toLowerCase().includes(q) ||
                    (s.serviceTitle || '').toLowerCase().includes(q) ||
                    (s.serviceDescription || '').toLowerCase().includes(q) ||
                    (s.serviceRate || '').toLowerCase().includes(q) ||
                    (s.location || '').toLowerCase().includes(q)
                  );
                })
                .sort((a, b) => {
                  const aHas = a.serviceTitle && a.serviceTitle.trim() ? 1 : 0;
                  const bHas = b.serviceTitle && b.serviceTitle.trim() ? 1 : 0;
                  if (aHas !== bHas) return bHas - aHas;
                  return b.updatedAt - a.updatedAt;
                });

              if (serviceSeekers.length === 0) {
                return (
                  <div className="rounded-3xl bg-white/95 border border-slate-200 shadow-lg p-8 text-center space-y-3">
                    <UserSearch className="h-10 w-10 text-violet-600 mx-auto" />
                    <h3 className="text-sm font-bold text-slate-900">No Seekers Found</h3>
                    <p className="text-xs text-slate-600 max-w-md mx-auto">
                      {q
                        ? 'No seekers match your search. Try searching a different skill or location.'
                        : 'Be the first seeker to list a service for hire to users on the app!'}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        playClickSound();
                        setServiceEditorOpen(true);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition"
                    >
                      <Briefcase className="h-3.5 w-3.5" />
                      <span>List Your Service</span>
                    </button>
                  </div>
                );
              }

              return serviceSeekers.map((seeker) => {
                const ratingInfo = seekerRatingsMap[seeker.uid];
                const isMe = currentUser?.uid === seeker.uid;
                const seekerAvatar = isMe
                  ? selfieDataUrl || myAvatarThumb || seeker.avatar || currentUser?.photoURL || null
                  : seeker.avatar;
                const hasImageAvatar = Boolean(
                  seekerAvatar && (seekerAvatar.startsWith('data:image') || seekerAvatar.startsWith('http'))
                );

                return (
                  <div
                    key={seeker.uid}
                    className="rounded-2xl bg-white/95 border border-slate-200 hover:border-violet-300 shadow-lg p-4 space-y-3 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              playClickSound();
                              if (hasImageAvatar && seekerAvatar) {
                                setLightboxDoc({
                                  title: `${seeker.displayName} — Face Selfie`,
                                  name: seeker.serviceTitle || 'Seeker Profile',
                                  url: seekerAvatar,
                                  isImage: true,
                                });
                              } else if (isMe) {
                                startCamera();
                              }
                            }}
                            className="h-14 w-14 rounded-full overflow-hidden bg-slate-100 border-2 border-violet-500/80 flex items-center justify-center shadow-sm hover:scale-105 transition"
                            title={hasImageAvatar ? 'View Face Selfie' : isMe ? 'Take Face Selfie' : 'No Selfie'}
                          >
                            {hasImageAvatar && seekerAvatar ? (
                              <img src={seekerAvatar} alt={`${seeker.displayName} face selfie`} className="h-full w-full object-cover" />
                            ) : (
                              <User className="h-6 w-6 text-violet-600" />
                            )}
                          </button>
                          {isMe && (
                            <button
                              type="button"
                              onClick={() => {
                                playClickSound();
                                startCamera();
                              }}
                              className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-violet-600 hover:bg-violet-500 text-white border border-white flex items-center justify-center shadow transition"
                              title="Update Face Selfie"
                            >
                              <Camera className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-slate-900 truncate">{seeker.displayName}</h3>
                            {isMe && (
                              <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200 text-[9px] font-black uppercase">
                                You
                              </span>
                            )}
                            {ratingInfo && ratingInfo.count > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold">
                                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                                {ratingInfo.avg.toFixed(1)} ({ratingInfo.count})
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-lg bg-violet-100 border border-violet-200 text-violet-800 text-xs font-bold">
                              {seeker.serviceTitle?.trim() || 'General Service'}
                            </span>
                            {seeker.serviceRate && (
                              <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold tabular-nums">
                                {seeker.serviceRate}
                              </span>
                            )}
                          </div>

                          {seeker.serviceDescription && (
                            <p className="text-xs text-slate-700 leading-relaxed">{seeker.serviceDescription}</p>
                          )}

                          {seeker.location && (
                            <p className="text-[11px] text-slate-500 flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-violet-600 shrink-0" />
                              <span className="truncate">{seeker.location}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                      {isMe ? (
                        <button
                          type="button"
                          onClick={() => {
                            playClickSound();
                            setServiceEditorOpen(true);
                          }}
                          className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition"
                        >
                          <Pencil className="h-3.5 w-3.5 text-violet-600" />
                          <span>Edit My Service</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            playClickSound();
                            openHireModal(seeker);
                          }}
                          className="min-h-[40px] px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-violet-600/20 transition active:scale-95"
                        >
                          <Briefcase className="h-3.5 w-3.5" />
                          <span>Hire Service</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Top Search Bar at Top of the Map */}
      {(activeTab === null || activeTab === 'gigs') && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-11/12 max-w-lg">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <div className="relative flex w-full items-center rounded-2xl bg-white shadow-2xl border border-slate-200 px-4 py-3 text-slate-900">
              <Search className="h-5 w-5 text-slate-400 mr-3 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search area, street, location, province..."
                className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
              />
              {isSearching && (
                <Loader2 className="h-4 w-4 animate-spin text-blue-600 ml-2 shrink-0" />
              )}
            </div>
          </form>

          {/* Autocomplete Dropdown */}
          {showDropdown && searchResults.length > 0 && (
            <div className="relative z-40 mt-2 max-h-60 overflow-y-auto rounded-2xl bg-white p-2 shadow-2xl border border-slate-200">
              {searchResults.map((result) => (
                <button
                  key={result.place_id}
                  onClick={() => selectLocation(result)}
                  className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 hover:bg-slate-50 rounded-xl transition flex items-start gap-2.5 border-b border-slate-100 last:border-0"
                >
                  <MapPin className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{result.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reminder Banner for New Signup & Unsubscribed Users: Tenant Spots Running Out Quickly */}
      {(activeTab === null || activeTab === 'gigs') &&
        !isSubscriptionActive &&
        !isMainTenant &&
        !activeAcceptedHire &&
        !navigatingCompany &&
        !isPickingGigLocation &&
        !dismissedTenantReminder && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-25 w-11/12 max-w-lg pointer-events-auto">
            <div className="rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 p-[1.5px] shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="rounded-[15px] bg-slate-950/95 backdrop-blur-md px-3.5 py-2.5 flex items-center justify-between gap-3 text-white">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-400/40 shrink-0">
                    <Sparkles className="h-4 w-4 animate-spin duration-3000" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                        Tenant spots are running out quickly!
                      </span>
                      <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[8px] font-black uppercase tracking-widest animate-pulse">
                        Fast Filling
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-300 truncate">
                      {offerConfig.maxTenantSignups > 0
                        ? `Only ${Math.max(0, offerConfig.maxTenantSignups - offerConfig.currentTenantSignups)} of ${offerConfig.maxTenantSignups} spots remaining. Claim yours now!`
                        : 'Limited tenant spots available. Lock in your Tenant Sub to earn monthly referral profits!'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      playClickSound();
                      if (!currentUser) {
                        setAuthModalOpen(true);
                      } else {
                        setUpgradeModalOpen(true);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-md transition transform active:scale-95 whitespace-nowrap"
                  >
                    Claim Spot
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playClickSound();
                      setDismissedTenantReminder(true);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
                    title="Dismiss reminder"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* GiGs Top Pick-Location Banner */}
      {activeTab === 'gigs' && isPickingGigLocation && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-25 w-11/12 max-w-md rounded-2xl bg-slate-900 text-white px-4 py-3 shadow-2xl border border-slate-700 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="h-4 w-4 text-emerald-400 shrink-0 animate-bounce" />
            <span className="font-semibold truncate">Tap exact map location to pin your gig</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                const center = mapInstanceRef.current?.getCenter();
                const lat = center?.lat || myUserCoords.lat;
                const lng = center?.lng || myUserCoords.lng;
                setIsPickingGigLocation(false);
                setGigLat(lat);
                setGigLng(lng);
                setGigLocationName(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
                setGigFormOpen(true);
              }}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              Use Center
            </button>
            <button
              type="button"
              onClick={() => setIsPickingGigLocation(false)}
              className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* GiGs Active Road Navigation Banner (when Hire is Accepted) */}
      {activeTab === 'gigs' && activeAcceptedHire && !isPickingGigLocation && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-25 w-11/12 max-w-md rounded-2xl bg-white/95 backdrop-blur-md p-3.5 shadow-2xl border border-blue-200 text-xs space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-2 rounded-xl bg-blue-600 text-white shrink-0">
                <Navigation className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-slate-900 truncate">
                  {activeAcceptedHire.serviceTitle} •{' '}
                  {currentUser?.uid === activeAcceptedHire.userId
                    ? activeAcceptedHire.seekerName
                    : activeAcceptedHire.userName}
                </h4>
                <p className="text-[11px] text-slate-500 truncate">
                  To: {activeAcceptedHire.destAddress}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {routeStats && (
                <span className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold">
                  {routeStats.distanceKm} km • {routeStats.durationMin} min
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  setHireChatOpen(true);
                }}
                className="relative h-8 w-8 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-sm transition"
                title="Chat during navigation"
              >
                <MessageCircle className="h-4 w-4" />
                {hireChatMessages.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center border border-white">
                    {hireChatMessages.length > 99 ? '99+' : hireChatMessages.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentUser?.uid === activeAcceptedHire.userId ? (
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  setRatingValue(5);
                  setRatingComment('');
                  setRatingModalHire(activeAcceptedHire);
                }}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-sm transition flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Gig Completed</span>
              </button>
            ) : (
              <div className="flex-1 py-2 px-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-800 font-semibold text-center text-[11px]">
                Navigate road to destination • User marks completion
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                playClickSound();
                setCancelReasonInput('');
                setCancelModalHire(activeAcceptedHire);
              }}
              className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold transition shrink-0"
            >
              Cancel Gig
            </button>
          </div>
        </div>
      )}

      {/* GiGs Active Company Voice Navigation Banner */}
      {activeTab === 'gigs' && navigatingCompany && !isPickingGigLocation && (
        <div
          className={`fixed ${activeAcceptedHire ? 'top-44' : 'top-20'} left-1/2 -translate-x-1/2 z-25 w-11/12 max-w-md rounded-2xl bg-white/95 backdrop-blur-md p-3.5 shadow-2xl border border-indigo-200 text-xs space-y-2.5`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 overflow-hidden">
                {navigatingCompany.logoUrl && navigatingCompany.logoUrl.startsWith('data:image/') ? (
                  <img src={navigatingCompany.logoUrl} alt={navigatingCompany.name} className="h-full w-full object-cover" />
                ) : (
                  <Navigation className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-slate-900 truncate">
                  Navigating to {navigatingCompany.name}
                </h4>
                <p className="text-[11px] text-slate-500 truncate">
                  {companyNavInstruction || navigatingCompany.locationName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {companyRouteStats && (
                <span className="text-[11px] font-bold text-indigo-700 tabular-nums whitespace-nowrap">
                  {companyRouteStats.distanceKm} km · {companyRouteStats.durationMin} min
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  const nextMuted = !companyVoiceMuted;
                  setCompanyVoiceMuted(nextMuted);
                  companyVoiceMutedRef.current = nextMuted;
                  if (nextMuted) {
                    stopLadyVoiceGuidance();
                  } else {
                    void speakLadyVoice(
                      `Navigating you to ${navigatingCompany.name}. ${
                        companyRouteStats
                          ? `${companyRouteStats.distanceKm} kilometers remaining, about ${companyRouteStats.durationMin} minutes.`
                          : ''
                      }`
                    );
                  }
                }}
                className={`h-8 w-8 rounded-xl border flex items-center justify-center transition ${
                  companyVoiceMuted
                    ? 'bg-slate-100 border-slate-200 text-slate-500'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100'
                }`}
                title={companyVoiceMuted ? 'Unmute Voice Guidance' : 'Mute Voice Guidance'}
              >
                {companyVoiceMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                playClickSound();
                void speakLadyVoice(
                  `Navigating you to ${navigatingCompany.name}. ${
                    companyRouteStats
                      ? `Distance ${companyRouteStats.distanceKm} kilometers, estimated time ${companyRouteStats.durationMin} minutes.`
                      : navigatingCompany.locationName
                  }`
                );
              }}
              className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-sm transition flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Volume2 className="h-3.5 w-3.5" />
              <span>Voice Update</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playClickSound();
                setViewingCompany(navigatingCompany);
              }}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition whitespace-nowrap"
            >
              View Page
            </button>
            <button
              type="button"
              onClick={() => {
                playClickSound();
                stopLadyVoiceGuidance();
                setNavigatingCompany(null);
              }}
              className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold transition whitespace-nowrap"
            >
              Stop
            </button>
          </div>
        </div>
      )}

      {/* Companies & Businesses Directory Panel (Opened from inside the Map Menu Icon) */}
      {(activeTab === null || activeTab === 'gigs') && companyGadgetOpen && (() => {
        const filteredGadgetCompanies = companiesList.filter((company) => {
          const q = companyGadgetQuery.trim().toLowerCase();
          if (!q) return true;
          return (
            company.name.toLowerCase().includes(q) ||
            company.category.toLowerCase().includes(q) ||
            company.locationName.toLowerCase().includes(q)
          );
        });

        return (
          <div className="fixed bottom-16 right-16 z-35 w-[min(calc(100vw-5rem),356px)] rounded-3xl bg-white/95 backdrop-blur-md border border-indigo-200 shadow-2xl overflow-hidden text-xs pointer-events-auto">
            <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
                  <Store className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-extrabold truncate">Companies & Businesses</h4>
                  <p className="text-[10px] text-indigo-100 truncate">
                    {companiesList.length} {companiesList.length === 1 ? 'business page' : 'business pages'} on map
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setFeatureInfoTab('companies');
                  }}
                  aria-label="Companies & Businesses Info"
                  className="h-8 w-8 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/25 flex items-center justify-center transition"
                  title="Company Gadget Info"
                >
                  <Info className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setCompanyGadgetOpen(false);
                  }}
                  aria-label="Close Company Gadget"
                  className="h-8 w-8 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center rounded-xl bg-slate-50 border border-slate-200 px-2.5 py-2">
                  <Search className="h-3.5 w-3.5 text-slate-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    value={companyGadgetQuery}
                    onChange={(e) => setCompanyGadgetQuery(e.target.value)}
                    placeholder="Search business or area..."
                    className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
                  />
                </div>
                {chosenSubscription !== 'user' && (
                  <button
                    type="button"
                    onClick={() => {
                      playClickSound();
                      setCompanyGadgetOpen(false);
                      handleStartAddCompany();
                    }}
                    className="px-2.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] flex items-center gap-1 shrink-0 transition whitespace-nowrap"
                    title="Add Company Page"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Page</span>
                  </button>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 pr-0.5">
                {filteredGadgetCompanies.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
                    <Store className="h-6 w-6 text-indigo-400 mx-auto" />
                    <p className="text-[11px] text-slate-500">
                      {companiesList.length === 0
                        ? 'No company or business pages published yet.'
                        : 'No companies match your search.'}
                    </p>
                  </div>
                ) : (
                  filteredGadgetCompanies.map((company) => {
                    const badgeImg =
                      company.logoUrl ||
                      company.ownerAvatar ||
                      seekersList.find((s) => s.uid === company.ownerId)?.avatar ||
                      null;
                    const hasLogo = Boolean(badgeImg && badgeImg.startsWith('data:image/'));
                    const isMine = currentUser?.uid === company.ownerId;
                    const myPendingRes = ownerCompanyReservations.filter(
                      (r) => r.companyId === company.id && r.status === 'pending'
                    ).length;

                    return (
                      <div
                        key={company.id}
                        className="p-2.5 rounded-2xl bg-slate-50 hover:bg-indigo-50/40 border border-slate-200 transition space-y-2"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="h-10 w-10 rounded-xl overflow-hidden bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center shrink-0">
                            {hasLogo && badgeImg ? (
                              <img
                                src={badgeImg}
                                alt={company.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Store className="h-5 w-5" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1.5">
                              <h5 className="text-xs font-extrabold text-slate-900 truncate">
                                {company.name}
                              </h5>
                              {isMine && myPendingRes > 0 && (
                                <span className="text-[10px] font-bold text-amber-700 shrink-0 tabular-nums">
                                  {myPendingRes} pending
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 truncate mt-0.5">
                              <span className="font-semibold text-indigo-700">
                                {company.category || 'Services'}
                              </span>
                              {company.openTimes && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="truncate">{company.openTimes}</span>
                                </>
                              )}
                              {company.acceptsReservations !== false && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-emerald-700 font-semibold">Bookings Open</span>
                                </>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 truncate mt-0.5 flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-indigo-500 shrink-0" />
                              <span className="truncate">{company.locationName}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              playClickSound();
                              setActiveTab('gigs');
                              mapInstanceRef.current?.flyTo([company.lat, company.lng], 16, { duration: 0.9 });
                            }}
                            className="py-1.5 px-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[11px] flex items-center justify-center gap-1 transition whitespace-nowrap"
                          >
                            <MapPin className="h-3 w-3 text-indigo-600" />
                            <span>Locate</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              playClickSound();
                              handleStartNavigateToCompany(company);
                            }}
                            className="py-1.5 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition whitespace-nowrap"
                          >
                            <Navigation className="h-3 w-3" />
                            <span>Navigate</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              playClickSound();
                              setCompanyGadgetOpen(false);
                              setViewingCompany(company);
                              setConfirmDeleteCompanyId(null);
                              setResFormOpen(false);
                            }}
                            className="flex-1 py-1.5 px-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition whitespace-nowrap"
                          >
                            <Store className="h-3 w-3" />
                            <span>Open Page</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Bottom Right: Map Menu (on top of Zoom) + Zoom + Satellite + Info (GiGs only), & Upgrade Bubble */}
      <div className="absolute bottom-32 sm:bottom-36 right-4 z-25 flex flex-col gap-2.5 items-end pointer-events-auto">
        {activeTab === 'gigs' && (
          <>
            {/* Map Menu Icon on Top of Zoom Feature (Create Gig, Add Company Page & Businesses) */}
            <div className="relative flex flex-col items-end">
              {mapToolsMenuOpen && (
                <div className="absolute right-14 top-0 w-52 rounded-2xl bg-white border border-slate-200 shadow-2xl p-1.5 space-y-1 z-30">
                  <button
                    type="button"
                    onClick={() => {
                      playClickSound();
                      setMapToolsMenuOpen(false);
                      handleStartCreateGig();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 transition text-left"
                  >
                    <div className="h-7 w-7 rounded-lg bg-emerald-500 text-white border border-emerald-400 flex items-center justify-center shrink-0 shadow-sm">
                      <PlusCircle className="h-4 w-4" />
                    </div>
                    <span>Create Gig</span>
                  </button>

                  {chosenSubscription !== 'user' && (
                    <button
                      type="button"
                      onClick={() => {
                        playClickSound();
                        setMapToolsMenuOpen(false);
                        handleStartAddCompany();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-800 hover:bg-indigo-50 hover:text-indigo-700 transition text-left"
                    >
                      <div className="h-7 w-7 rounded-lg bg-indigo-500 text-white border border-indigo-400 flex items-center justify-center shrink-0 shadow-sm">
                        <Store className="h-4 w-4" />
                      </div>
                      <span>Add Company Page</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      playClickSound();
                      setMapToolsMenuOpen(false);
                      setCompanyGadgetOpen((prev) => !prev);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition text-left ${
                      companyGadgetOpen
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-800 hover:bg-indigo-50 hover:text-indigo-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                          companyGadgetOpen
                            ? 'bg-white/20 text-white'
                            : 'bg-indigo-500 text-white border border-indigo-400 shadow-sm'
                        }`}
                      >
                        <Building2 className="h-4 w-4" />
                      </div>
                      <span className="truncate">Businesses</span>
                    </div>
                    <span
                      className={`text-[11px] font-extrabold tabular-nums shrink-0 ${
                        companyGadgetOpen ? 'text-indigo-100' : 'text-slate-500'
                      }`}
                    >
                      {companiesList.length}
                      {ownerCompanyReservations.filter((r) => r.status === 'pending').length > 0
                        ? ` · ${ownerCompanyReservations.filter((r) => r.status === 'pending').length} new`
                        : ''}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playClickSound();
                      setMapToolsMenuOpen(false);
                      setActiveTab('settings');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-800 hover:bg-blue-50 hover:text-blue-700 transition text-left"
                  >
                    <div className="h-7 w-7 rounded-lg bg-blue-500 text-white border border-blue-400 flex items-center justify-center shrink-0 shadow-sm">
                      <Settings className="h-4 w-4" />
                    </div>
                    <span>Settings</span>
                  </button>
                </div>
              )}

              {/* Colorful Menu Bubble */}
              <div className="relative flex flex-col items-center mb-2">
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setCompanyGadgetOpen(false);
                    setMapToolsMenuOpen((prev) => !prev);
                  }}
                  className={`flex items-center justify-center h-11 w-11 rounded-2xl border shadow-xl transition transform active:scale-95 ${
                    mapToolsMenuOpen || companyGadgetOpen || isPickingGigLocation || isPickingCompanyLocation
                      ? 'bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 border-indigo-300 text-white shadow-[0_8px_20px_rgba(99,102,241,0.55)]'
                      : 'bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 border-indigo-300 text-white shadow-[0_8px_20px_rgba(99,102,241,0.45)] hover:brightness-110'
                  }`}
                  title="Map Menu"
                >
                  {mapToolsMenuOpen ? <X className="h-5 w-5 text-white" /> : <Compass className="h-5 w-5 text-white" />}
                </button>
                <span className="text-[10px] font-bold mt-1 text-white bg-indigo-700/90 px-2 py-0.5 rounded-full border border-indigo-400/70 shadow-md whitespace-nowrap">Menu</span>
              </div>

              {/* Zoom In Bubble (Emerald) */}
              <button
                onClick={() => {
                  playClickSound();
                  handleZoomIn();
                }}
                className="mb-2 flex items-center justify-center h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 border border-emerald-300 text-white shadow-[0_8px_18px_rgba(16,185,129,0.4)] hover:brightness-110 transition transform active:scale-95"
                title="Zoom In"
              >
                <Plus className="h-5 w-5 stroke-[2.5]" />
              </button>

              {/* Zoom Out Bubble (Amber/Orange) */}
              <button
                onClick={() => {
                  playClickSound();
                  handleZoomOut();
                }}
                className="mb-2 flex items-center justify-center h-10 w-10 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 border border-amber-300 text-white shadow-[0_8px_18px_rgba(245,158,11,0.4)] hover:brightness-110 transition transform active:scale-95"
                title="Zoom Out"
              >
                <Minus className="h-5 w-5 stroke-[2.5]" />
              </button>
            </div>

            {/* Satellite View Bubble (Sky/Blue) */}
            <div className="relative flex flex-col items-center mb-1">
              <button
                onClick={() => {
                  playClickSound();
                  toggleSatellite();
                }}
                className={`flex items-center justify-center h-10 w-10 rounded-2xl border shadow-xl transition transform active:scale-95 ${
                  isSatellite
                    ? 'bg-gradient-to-br from-sky-500 via-blue-600 to-cyan-500 text-white border-sky-300 shadow-[0_8px_20px_rgba(14,165,233,0.45)] ring-2 ring-sky-400/40'
                    : 'bg-gradient-to-br from-slate-700 to-slate-900 text-sky-300 border-slate-600 shadow-[0_6px_16px_rgba(15,23,42,0.3)]'
                }`}
                title={isSatellite ? "Satellite View (Active - click to switch to Map)" : "Map View (Click for Satellite)"}
              >
                <Satellite className="h-5 w-5" />
              </button>
              <span className={`text-[9px] font-bold mt-1 px-1.5 py-0.2 rounded-full border shadow-sm whitespace-nowrap ${isSatellite ? 'bg-sky-600 text-white border-sky-400' : 'bg-slate-800 text-slate-200 border-slate-700'}`}>
                {isSatellite ? 'Sat' : 'Map'}
              </span>
            </div>

          </>
        )}

        {/* Upgrade Icon Feature Bubble: hidden once subscription/trial is activated, reappears when ended */}
        {!isSubscriptionActive && (
          <div className="relative flex items-center">
            <span className="absolute -top-1 -right-1 flex h-3 w-3 z-10 pointer-events-none">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
            <button
              onClick={() => {
                playClickSound();
                setUpgradeModalOpen(true);
              }}
              className="flex items-center justify-center h-10 w-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xl hover:opacity-90 transition transform active:scale-95"
              title="Upgrade Subscriptions — Tenant spots running out quickly!"
            >
              <Crown className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* See-Through Glass Bottom Menu Bar (Spread out and fill the bottom) */}
      <div className="fixed bottom-3 inset-x-3 sm:inset-x-8 md:mx-auto md:max-w-3xl z-40 pointer-events-auto">
        <nav className="w-full rounded-3xl bg-white/25 backdrop-blur-xl border border-white/45 shadow-[0_10px_34px_rgba(15,23,42,0.24),inset_0_1px_1px_rgba(255,255,255,0.7)] px-3 sm:px-6 py-2">
          {chosenSubscription === 'user' ? (
            /* User Sub: ONLY Seekers, GiGs, and Profile (Spread out to fill bottom) */
            <div className="w-full flex items-end justify-between">
              {/* Seekers Icon (Small) */}
              <button
                onClick={() => {
                  playClickSound();
                  setActiveTab((prev) => (prev === 'seekers' ? 'gigs' : 'seekers'));
                }}
                className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center group transition transform active:scale-95"
                title="Seekers"
              >
                <div
                  className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border transition group-hover:scale-110 ${
                    activeTab === 'seekers'
                      ? 'bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700 text-white border-violet-300 shadow-[0_6px_16px_rgba(139,92,246,0.45),inset_0_1px_1px_rgba(255,255,255,0.5)]'
                      : 'bg-white/75 backdrop-blur-md text-violet-700 border-white/70 shadow-[0_4px_12px_rgba(15,23,42,0.14)] hover:bg-white/95'
                  }`}
                >
                  <UserSearch className="h-4 w-4 drop-shadow-sm" />
                </div>
                <span
                  className={`text-[9px] font-bold mt-1 px-2 py-0.2 rounded-full border shadow-sm whitespace-nowrap transition ${
                    activeTab === 'seekers'
                      ? 'bg-violet-600 text-white border-violet-400'
                      : 'bg-white/75 backdrop-blur-sm text-slate-900 border-white/60 group-hover:text-violet-700'
                  }`}
                >
                  Seekers
                </span>
              </button>

              {/* GiGs Icon (Small Center Hero) */}
              <button
                onClick={() => {
                  playClickSound();
                  setActiveTab('gigs');
                }}
                className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center group transition transform active:scale-95 -mt-1.5"
                title="GiGs"
              >
                <div
                  className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border transition group-hover:scale-110 ${
                    activeTab === 'gigs'
                      ? 'border-white/60 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 text-white shadow-[0_8px_20px_rgba(37,99,235,0.55),inset_0_2px_2px_rgba(255,255,255,0.5)]'
                      : 'border-white/70 bg-white/80 backdrop-blur-md text-blue-600 shadow-[0_6px_16px_rgba(37,99,235,0.22)] hover:bg-white/95'
                  }`}
                >
                  <Zap className="h-5 w-5 drop-shadow-[0_2px_2px_rgba(0,0,0,0.25)]" />
                </div>
                <span
                  className={`text-[9px] font-black mt-1 px-2 py-0.2 rounded-full border shadow-sm whitespace-nowrap transition ${
                    activeTab === 'gigs'
                      ? 'bg-blue-600 text-white border-blue-400'
                      : 'bg-white/75 backdrop-blur-sm text-blue-700 border-white/60'
                  }`}
                >
                  GiGs
                </span>
              </button>

              {/* Profile Icon (Small) */}
              <button
                onClick={() => {
                  playClickSound();
                  setActiveTab((prev) => (prev === 'profile' ? 'gigs' : 'profile'));
                }}
                className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center group transition transform active:scale-95"
                title="Profile"
              >
                <div
                  className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border transition group-hover:scale-110 ${
                    activeTab === 'profile'
                      ? 'bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700 text-white border-sky-300 shadow-[0_6px_16px_rgba(14,165,233,0.45),inset_0_1px_1px_rgba(255,255,255,0.5)]'
                      : 'bg-white/75 backdrop-blur-md text-sky-700 border-white/70 shadow-[0_4px_12px_rgba(15,23,42,0.14)] hover:bg-white/95'
                  }`}
                >
                  <IdCard className="h-4 w-4 drop-shadow-sm" />
                </div>
                <span
                  className={`text-[9px] font-bold mt-1 px-2 py-0.2 rounded-full border shadow-sm whitespace-nowrap transition ${
                    activeTab === 'profile'
                      ? 'bg-sky-600 text-white border-sky-400'
                      : 'bg-white/75 backdrop-blur-sm text-slate-900 border-white/60 group-hover:text-sky-700'
                  }`}
                >
                  Profile
                </span>
              </button>
            </div>
          ) : (
            /* Tenant Sub: Tenant, Referrals, GiGs, Seekers, Help (Spread out to fill bottom) */
            <div className="w-full flex items-end justify-between">
              {/* Tenant Icon (Small) */}
              <button
                onClick={() => {
                  playClickSound();
                  setActiveTab((prev) => (prev === 'tenant' ? 'gigs' : 'tenant'));
                }}
                className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center group transition transform active:scale-95"
                title="Tenant"
              >
                <div
                  className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border transition group-hover:scale-110 ${
                    activeTab === 'tenant'
                      ? 'bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 text-white border-amber-300 shadow-[0_6px_16px_rgba(245,158,11,0.45),inset_0_1px_1px_rgba(255,255,255,0.5)]'
                      : 'bg-white/75 backdrop-blur-md text-amber-700 border-white/70 shadow-[0_4px_12px_rgba(15,23,42,0.14)] hover:bg-white/95'
                  }`}
                >
                  <Building2 className="h-4 w-4 drop-shadow-sm" />
                </div>
                <span
                  className={`text-[9px] font-bold mt-1 px-1.5 py-0.2 rounded-full border shadow-sm whitespace-nowrap transition ${
                    activeTab === 'tenant'
                      ? 'bg-amber-600 text-white border-amber-400'
                      : 'bg-white/75 backdrop-blur-sm text-slate-900 border-white/60 group-hover:text-amber-700'
                  }`}
                >
                  Tenant
                </span>
              </button>

              {/* Referrals Icon (Small) */}
              <button
                onClick={() => {
                  playClickSound();
                  setActiveTab((prev) => (prev === 'referrals' ? 'gigs' : 'referrals'));
                }}
                className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center group transition transform active:scale-95"
                title="Referrals"
              >
                <div
                  className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border transition group-hover:scale-110 ${
                    activeTab === 'referrals'
                      ? 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white border-emerald-300 shadow-[0_6px_16px_rgba(16,185,129,0.45),inset_0_1px_1px_rgba(255,255,255,0.5)]'
                      : 'bg-white/75 backdrop-blur-md text-emerald-700 border-white/70 shadow-[0_4px_12px_rgba(15,23,42,0.14)] hover:bg-white/95'
                  }`}
                >
                  <Share2 className="h-4 w-4 drop-shadow-sm" />
                </div>
                <span
                  className={`text-[9px] font-bold mt-1 px-1.5 py-0.2 rounded-full border shadow-sm whitespace-nowrap transition ${
                    activeTab === 'referrals'
                      ? 'bg-emerald-600 text-white border-emerald-400'
                      : 'bg-white/75 backdrop-blur-sm text-slate-900 border-white/60 group-hover:text-emerald-700'
                  }`}
                >
                  Referrals
                </span>
              </button>

              {/* GiGs Icon (Small Center Hero) */}
              <button
                onClick={() => {
                  playClickSound();
                  setActiveTab('gigs');
                }}
                className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center group transition transform active:scale-95 -mt-1.5"
                title="GiGs"
              >
                <div
                  className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border transition group-hover:scale-110 ${
                    activeTab === 'gigs'
                      ? 'border-white/60 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 text-white shadow-[0_8px_20px_rgba(37,99,235,0.55),inset_0_2px_2px_rgba(255,255,255,0.5)]'
                      : 'border-white/70 bg-white/80 backdrop-blur-md text-blue-600 shadow-[0_6px_16px_rgba(37,99,235,0.22)] hover:bg-white/95'
                  }`}
                >
                  <Zap className="h-5 w-5 drop-shadow-[0_2px_2px_rgba(0,0,0,0.25)]" />
                </div>
                <span
                  className={`text-[9px] font-black mt-1 px-2 py-0.2 rounded-full border shadow-sm whitespace-nowrap transition ${
                    activeTab === 'gigs'
                      ? 'bg-blue-600 text-white border-blue-400'
                      : 'bg-white/75 backdrop-blur-sm text-blue-700 border-white/60'
                  }`}
                >
                  GiGs
                </span>
              </button>

              {/* Seekers Icon (Small) */}
              <button
                onClick={() => {
                  playClickSound();
                  setActiveTab((prev) => (prev === 'seekers' ? 'gigs' : 'seekers'));
                }}
                className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center group transition transform active:scale-95"
                title="Seekers"
              >
                <div
                  className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border transition group-hover:scale-110 ${
                    activeTab === 'seekers'
                      ? 'bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700 text-white border-violet-300 shadow-[0_6px_16px_rgba(139,92,246,0.45),inset_0_1px_1px_rgba(255,255,255,0.5)]'
                      : 'bg-white/75 backdrop-blur-md text-violet-700 border-white/70 shadow-[0_4px_12px_rgba(15,23,42,0.14)] hover:bg-white/95'
                  }`}
                >
                  <UserSearch className="h-4 w-4 drop-shadow-sm" />
                </div>
                <span
                  className={`text-[9px] font-bold mt-1 px-1.5 py-0.2 rounded-full border shadow-sm whitespace-nowrap transition ${
                    activeTab === 'seekers'
                      ? 'bg-violet-600 text-white border-violet-400'
                      : 'bg-white/75 backdrop-blur-sm text-slate-900 border-white/60 group-hover:text-violet-700'
                  }`}
                >
                  Seekers
                </span>
              </button>

              {/* Help Icon (Small) */}
              <button
                onClick={() => {
                  playClickSound();
                  setSettingsHelpOpen((prev) => !prev);
                }}
                className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center group transition transform active:scale-95"
                title="Help"
              >
                <div
                  className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border transition group-hover:scale-110 ${
                    settingsHelpOpen
                      ? 'bg-gradient-to-br from-rose-500 via-pink-600 to-rose-700 text-white border-rose-300 shadow-[0_6px_16px_rgba(244,63,94,0.45),inset_0_1px_1px_rgba(255,255,255,0.5)]'
                      : 'bg-white/75 backdrop-blur-md text-rose-700 border-white/70 shadow-[0_4px_12px_rgba(15,23,42,0.14)] hover:bg-white/95'
                  }`}
                >
                  <HelpCircle className="h-4 w-4 drop-shadow-sm" />
                </div>
                <span
                  className={`text-[9px] font-bold mt-1 px-1.5 py-0.2 rounded-full border shadow-sm whitespace-nowrap transition ${
                    settingsHelpOpen
                      ? 'bg-rose-600 text-white border-rose-400'
                      : 'bg-white/75 backdrop-blur-sm text-slate-900 border-white/60 group-hover:text-rose-700'
                  }`}
                >
                  Help
                </span>
              </button>
            </div>
          )}
        </nav>
      </div>

      {/* Settings Feature View */}
      {activeTab === 'settings' && (
        <div className="fixed inset-0 z-30 bg-gradient-to-br from-gray-100/95 via-gray-200/95 to-slate-300/95 backdrop-blur-2xl flex flex-col items-center justify-center p-5 pb-20 text-slate-900 overflow-y-auto">
          <FloatingToolsWallpaper opacity="opacity-90" />
          <div className="relative z-10 w-full max-w-sm rounded-3xl bg-white/95 p-6 shadow-2xl border border-slate-200 flex flex-col items-center gap-4 text-center">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
              <Settings className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Settings</h3>
              <p className="text-xs text-slate-500 mt-0.5">Manage your account session &amp; subscription status</p>
            </div>

            {/* Subscription Status Card (Single Locked Plan Until It Ends) */}
            <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col gap-2 text-left">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700">Subscription Plan</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    isMainTenant
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : isSubscriptionEnded
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : isSubscriptionLocked
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {isMainTenant
                    ? 'Main Tenant'
                    : chosenSubscription === 'tenant'
                    ? 'Tenant Sub'
                    : chosenSubscription === 'company'
                    ? 'Company Sub'
                    : chosenSubscription === 'user'
                    ? 'User Sub'
                    : 'Not Selected'}
                </span>
              </div>

              {isMainTenant ? (
                <p className="text-[11px] text-slate-600">
                  Main Tenant account active. You receive direct and User Sub referrals in Referrals.
                </p>
              ) : isSubscriptionLocked ? (
                <>
                  <div className="flex items-center justify-between text-[11px] text-slate-700 font-semibold">
                    <span>Status: {mySubmissionStatus === 'pending' ? 'Pending Review' : hasActiveTrial ? 'Free Trial' : 'Active'}</span>
                    <span className="tabular-nums text-blue-700">{timeLeft}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug">
                    You can only hold 1 subscription at a time and cannot switch plans while it is active. When this subscription ends, you can decide which subscription to activate again.
                  </p>
                  {mySubmissionStatus === 'none' && !hasActiveTrial && (
                    <button
                      type="button"
                      onClick={() => {
                        playClickSound();
                        setSelectedSubTier(
                          chosenSubscription === 'tenant'
                            ? 'Tenant Sub (R299.99)'
                            : chosenSubscription === 'company'
                            ? 'Company Sub (R199.99)'
                            : 'User Sub (R29.99)'
                        );
                        setOnboardingModalOpen(true);
                      }}
                      className="w-full min-h-[40px] mt-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition"
                    >
                      Complete Verification
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    {isSubscriptionEnded
                      ? 'Your previous subscription has ended. Decide which subscription plan you want to activate next.'
                      : 'Choose 1 subscription plan to unlock the app features.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      playClickSound();
                      setStartupSubChooserDismissed(false);
                      setUpgradeModalOpen(true);
                    }}
                    className="w-full min-h-[42px] py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition"
                  >
                    Choose Subscription Plan
                  </button>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                playClickSound();
                setActiveTab('gigs');
              }}
              className="w-full min-h-[44px] py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
            >
              Back to Map
            </button>

            <button
              type="button"
              onClick={() => {
                playClickSound();
                handleSignOut();
              }}
              className="w-full min-h-[44px] py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 transition"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* Dedicated Tenant Feature View */}
      {activeTab === 'tenant' && (
        <div className="fixed inset-0 z-35 bg-gradient-to-br from-gray-100/95 via-gray-200/95 to-slate-300/95 backdrop-blur-2xl flex flex-col text-slate-900 overflow-y-auto pb-28">
          <FloatingToolsWallpaper opacity="opacity-85" />

          {/* Top Bar with Profile Logo and Close */}
          <div className="relative z-10 flex items-center justify-between p-4 sm:p-6 border-b border-slate-300/80 max-w-3xl mx-auto w-full">
            <div className="flex items-center gap-3">
              {/* Profile logo with user face selfie in it */}
              <div className="relative group">
                <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full border-2 border-amber-500 p-0.5 shadow-lg shadow-amber-500/20 bg-white flex items-center justify-center overflow-hidden">
                  {selfieDataUrl || myAvatarThumb || currentUser?.photoURL ? (
                    <img
                      src={selfieDataUrl || myAvatarThumb || currentUser?.photoURL || ''}
                      alt="User Face Selfie"
                      className="h-full w-full object-cover rounded-full"
                    />
                  ) : (
                    <User className="h-6 w-6 text-amber-600" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={startCamera}
                  className="absolute -bottom-1 -right-1 p-1.5 bg-amber-500 hover:bg-amber-400 text-white rounded-full shadow transition"
                  title="Update Face Selfie"
                >
                  <Camera className="h-3 w-3" />
                </button>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-slate-900">
                    {firstName || lastName ? `${firstName} ${lastName}`.trim() : (currentUser?.displayName || 'Tenant Partner')}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-[10px] font-black uppercase text-white shadow-sm">
                    Tenant
                  </span>
                </div>
                <p className="text-xs text-slate-600">{currentUser?.email || 'Active Tenant Account'}</p>
              </div>
            </div>

            <button
              onClick={() => {
                playClickSound();
                setActiveTab('gigs');
              }}
              className="min-h-[44px] min-w-[44px] p-2.5 rounded-2xl bg-white/90 hover:bg-white text-slate-700 border border-slate-300/80 shadow-sm flex items-center justify-center transition"
              title="Close to Map"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="relative z-10 max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 space-y-8">
            {/* Total Profit Balance - EXPLICITLY NOT IN A BOX */}
            <div className="text-center py-4">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-amber-700">
                Total Profit Balance
              </span>
              <div className="text-4xl sm:text-6xl md:text-7xl font-black text-slate-900 tracking-tight mt-1 tabular-nums">
                R{totalProfit.toFixed(2)}
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-2">
                Live net profit accumulated from your network referrals
              </p>
            </div>

            {/* Tenant Sub Profit and User Sub Profit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-white/95 border border-slate-200 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                    Tenant Sub Profit
                  </span>
                  <Building2 className="h-4 w-4 text-amber-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                  R{tenantProfit.toFixed(2)}
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  From {tenantSubApprovedCount} active approved Tenant {tenantSubApprovedCount === 1 ? 'referral' : 'referrals'}
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white/95 border border-slate-200 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                    User Sub Profit
                  </span>
                  <Users className="h-4 w-4 text-blue-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                  R{userProfit.toFixed(2)}
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  From {userSubApprovedCount} active approved User {userSubApprovedCount === 1 ? 'referral' : 'referrals'}
                </p>
              </div>
            </div>

            {/* Tenant Referral Link to Share and Build Network */}
            <div className="p-6 rounded-3xl bg-white/95 border border-amber-300/80 shadow-xl space-y-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Share2 className="h-5 w-5 text-amber-600" />
                  <span>Tenant Referral Link</span>
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Share your personalized referral link to invite Tenants and Users, build your network, and earn monthly subscription profits.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1 rounded-xl bg-slate-100 border border-slate-300 px-3.5 py-2.5 text-xs text-slate-800 font-mono truncate select-all">
                  {typeof window !== 'undefined' ? `${window.location.origin}?ref=${myReferralCode || 'YOUR_CODE'}` : `?ref=${myReferralCode || 'YOUR_CODE'}`}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const link = `${window.location.origin}?ref=${myReferralCode}`;
                    navigator.clipboard?.writeText(link);
                    playClickSound();
                    setCopiedLink(link);
                    setTimeout(() => setCopiedLink(null), 3000);
                  }}
                  className="min-h-[42px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-md shadow-amber-500/20 active:scale-95 shrink-0"
                >
                  <Copy className="h-4 w-4" />
                  <span>{copiedLink ? 'Copied Link!' : 'Copy Link'}</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1 items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const link = `${window.location.origin}?ref=${myReferralCode}`;
                    const text = `Join my network on TimeGiG! Sign up with my Tenant referral link to get started: ${link}`;
                    if (navigator.share) {
                      navigator.share({ title: 'TimeGiG Tenant Network', text, url: link }).catch(() => {});
                    } else {
                      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                    }
                  }}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs flex items-center gap-2 transition"
                >
                  <Share2 className="h-3.5 w-3.5 text-amber-600" />
                  <span>Share with Network / WhatsApp</span>
                </button>

                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span>Referral Code:</span>
                  <span className="font-mono font-bold text-amber-700">{myReferralCode || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Collapsible Pricing & Approval Settings */}
            <div className="pt-2 border-t border-slate-300/80">
              <button
                type="button"
                onClick={() => setTenantMenuOpen((prev) => !prev)}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-white/90 hover:bg-white border border-slate-300 text-xs font-semibold text-slate-800 flex items-center justify-between shadow-sm transition"
              >
                <span>Subscription Pricing & Approval Settings</span>
                <span className="text-[11px] text-amber-700 font-bold">{tenantMenuOpen ? 'Hide ▲' : 'Configure ▼'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Profile Feature View (Selfie Logo, Required Fields, User Sub Referral Link & Reward Points Cash Conversion / Withdrawal) */}
      {activeTab === 'profile' && (
        <div className="fixed inset-0 z-35 bg-gradient-to-br from-gray-100/95 via-gray-200/95 to-slate-300/95 backdrop-blur-2xl flex flex-col text-slate-900 overflow-y-auto pb-28">
          <FloatingToolsWallpaper opacity="opacity-85" />

          {/* Top Bar with Close / Back to Map */}
          <div className="relative z-10 flex items-center justify-between p-4 sm:p-6 border-b border-slate-300/80 max-w-lg mx-auto w-full">
            <h2 className="text-base sm:text-lg font-black text-slate-900">Profile</h2>
            <button
              onClick={() => {
                playClickSound();
                setActiveTab('gigs');
              }}
              className="min-h-[44px] min-w-[44px] p-2.5 rounded-2xl bg-white/90 hover:bg-white text-slate-700 border border-slate-300/80 shadow-sm flex items-center justify-center transition"
              title="Close to Map"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="relative z-10 max-w-lg mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
            <form onSubmit={handleProfileSubmit} className="space-y-6 rounded-3xl bg-white/95 border border-slate-200 shadow-xl p-5 sm:p-6">
              {/* Profile Logo with User Face Selfie Inside */}
              <div className="flex flex-col items-center justify-center text-center">
                <div className="relative">
                  <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full border-4 border-sky-500 p-1 shadow-xl shadow-sky-500/15 bg-slate-100 flex items-center justify-center overflow-hidden">
                    {selfieDataUrl || myAvatarThumb || currentUser?.photoURL ? (
                      <img
                        src={selfieDataUrl || myAvatarThumb || currentUser?.photoURL || ''}
                        alt="User Face Selfie"
                        className="h-full w-full object-cover rounded-full"
                      />
                    ) : (
                      <User className="h-12 w-12 text-sky-600" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="absolute bottom-1 right-1 p-2 bg-sky-600 hover:bg-sky-500 text-white rounded-full shadow-lg transition active:scale-95"
                    title="Take / Update Face Selfie"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={startCamera}
                  className="mt-2 text-xs font-semibold text-sky-700 hover:text-sky-600 transition"
                >
                  {selfieDataUrl || myAvatarThumb ? 'Change Face Selfie' : 'Take Face Selfie'}
                </button>
              </div>

              {profileSuccessMsg && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold text-center">
                  {profileSuccessMsg}
                </div>
              )}

              <div className="space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-3.5 h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      disabled
                      value={currentUser?.email || ''}
                      className="w-full rounded-2xl bg-slate-100 border border-slate-200 py-3 pl-10 pr-4 text-xs text-slate-600 cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Name & Surname Required */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <User className="absolute left-3.5 h-4 w-4 text-slate-500" />
                      <input
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="First Name"
                        className="w-full rounded-2xl bg-slate-50 border border-slate-300 py-3 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Surname <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <User className="absolute left-3.5 h-4 w-4 text-slate-500" />
                      <input
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Surname"
                        className="w-full rounded-2xl bg-slate-50 border border-slate-300 py-3 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Location Required */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Location <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <MapPin className="absolute left-3.5 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={locationInput}
                      onChange={(e) => setLocationInput(e.target.value)}
                      placeholder="City, Province or Area"
                      className="w-full rounded-2xl bg-slate-50 border border-slate-300 py-3 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Contact Information Required */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Contact Information <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <Phone className="absolute left-3.5 h-4 w-4 text-slate-500" />
                    <input
                      type="tel"
                      required
                      value={contactInfo}
                      onChange={(e) => setContactInfo(e.target.value)}
                      placeholder="Phone or WhatsApp number"
                      className="w-full rounded-2xl bg-slate-50 border border-slate-300 py-3 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white transition"
                    />
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <button
                type="submit"
                disabled={isSavingProfile}
                className="w-full min-h-[44px] py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-sky-600/25 transition disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
              >
                {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <span>{isSavingProfile ? 'Saving...' : 'Save Profile'}</span>
              </button>
            </form>

            {/* User Sub Referral Link */}
            <div className="p-5 rounded-3xl bg-white/95 border border-sky-200 shadow-xl space-y-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-sky-600" />
                  <span>User Sub Referral Link</span>
                </h3>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Share your User Sub referral link to invite new users. Main Tenant ({MAIN_TENANT_EMAIL}) receives and reviews them directly in Referrals.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1 rounded-xl bg-slate-100 border border-slate-300 px-3 py-2 text-xs text-slate-800 font-mono truncate select-all">
                  {typeof window !== 'undefined'
                    ? `${window.location.origin}?ref=${myReferralCode || 'YOUR_CODE'}`
                    : `?ref=${myReferralCode || 'YOUR_CODE'}`}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const link = `${window.location.origin}?ref=${myReferralCode}`;
                    handleCopy(link, 'profile-user-ref');
                    playClickSound();
                  }}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-md shadow-sky-600/20 active:scale-95 shrink-0"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>{copiedLink === 'profile-user-ref' ? 'Copied Link!' : 'Copy Link'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const link = `${window.location.origin}?ref=${myReferralCode}`;
                    const text = `Join TimeGiG! Sign up with my referral link: ${link}`;
                    if (navigator.share) {
                      navigator.share({ title: 'TimeGiG User Referral', text, url: link }).catch(() => {});
                    } else {
                      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                    }
                  }}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs flex items-center gap-1.5 transition"
                >
                  <Share2 className="h-3.5 w-3.5 text-sky-600" />
                  <span>Share Link</span>
                </button>
                <span className="text-[11px] text-slate-600">
                  Code: <span className="font-mono font-bold text-sky-700">{myReferralCode || 'N/A'}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Tenant 3-Bar Menu Overlay with Top/Bottom Bar Separating Every Section */}
      {activeTab === 'tenant' && tenantMenuOpen && (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-100/95 via-gray-200/95 to-slate-300/95 backdrop-blur-2xl flex flex-col text-slate-900">
          <FloatingToolsWallpaper opacity="opacity-85" />



          {/* Full-Screen Body Area Showing the Selected Top-Bar Section */}
          <div className="relative z-10 flex-1 overflow-y-auto p-4 md:p-6">
            <div className="max-w-3xl mx-auto w-full space-y-4">
              {/* SECTION 1: SUBSCRIPTION FEES */}
              {tenantMenuSection === 'fees' && (
                <form
                  onSubmit={handleSaveTenantConfig}
                  className="rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 text-xs"
                >
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-base font-extrabold text-slate-900">Monthly Subscription Fees</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {isMainTenant
                        ? 'Set monthly fees for Tenant Sub, User Sub, and Company Sub referrals'
                        : 'Set monthly subscription fees for your referrals (Tenants, Users, and Companies)'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <label className="block font-bold text-slate-800">Tenant Sub Fee (R)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1000000"
                        value={draftTenantFee}
                        onChange={(e) => setDraftTenantFee(e.target.value)}
                        className="w-full rounded-xl bg-white border border-slate-200 p-2.5 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      <span className="text-[10px] text-slate-500 block">Per month for new Tenant referrals</span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <label className="block font-bold text-slate-800">User Sub Fee (R)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1000000"
                        value={draftUserFee}
                        onChange={(e) => setDraftUserFee(e.target.value)}
                        className="w-full rounded-xl bg-white border border-slate-200 p-2.5 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      <span className="text-[10px] text-slate-500 block">Per month for new User referrals</span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-1.5">
                      <label className="block font-bold text-indigo-950 flex items-center gap-1.5">
                        <Store className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Company Sub Fee (R)</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1000000"
                        value={draftCompanyFee}
                        onChange={(e) => setDraftCompanyFee(e.target.value)}
                        className="w-full rounded-xl bg-white border border-indigo-200 p-2.5 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                      <span className="text-[10px] text-indigo-700 block">
                        Per month for new Company referrals
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingTenantConfig}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isSavingTenantConfig && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>Save Subscription Fees</span>
                  </button>
                </form>
              )}

              {/* SECTION 2: TRIAL DAYS */}
              {tenantMenuSection === 'trials' && (
                <form
                  onSubmit={handleSaveTenantConfig}
                  className="rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 text-xs"
                >
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-base font-extrabold text-slate-900">Free Trial Days</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Configure free trial periods for your referrals and companies (0 = no free trial)
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <label className="block font-bold text-slate-800">
                        {isMainTenant ? 'Trial Days for New Referrals' : 'Trial Days for Your Referrals'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="365"
                        step="1"
                        value={draftTrialDays}
                        onChange={(e) => setDraftTrialDays(e.target.value)}
                        className="w-full rounded-xl bg-white border border-slate-200 p-2.5 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      <p className="text-[10px] text-slate-500">
                        Free days granted to Tenant Sub & User Sub referrals signing up via your link.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2">
                      <label className="block font-bold text-indigo-950 flex items-center gap-1.5">
                        <Store className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Trial Days for Companies</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="365"
                        step="1"
                        value={draftCompanyTrialDays}
                        onChange={(e) => setDraftCompanyTrialDays(e.target.value)}
                        className="w-full rounded-xl bg-white border border-indigo-200 p-2.5 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                      <p className="text-[10px] text-indigo-700">
                        Free trial days granted specifically to Company Sub referrals signing up via your link.
                      </p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingTenantConfig}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isSavingTenantConfig && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>Save Trial Days</span>
                  </button>
                </form>
              )}

              {/* SECTION 3: SIGNUP LIMITS */}
              {tenantMenuSection === 'limits' && (
                <div className="space-y-4 text-xs">
                  {isMainTenant ? (
                    <>
                      <form
                        onSubmit={handleSaveTenantConfig}
                        className="rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4"
                      >
                        <div className="border-b border-slate-100 pb-3">
                          <h3 className="text-base font-extrabold text-slate-900">
                            Main Tenant — Total Signup Limits
                          </h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Control total Tenant Sub, User Sub, and Company Sub signups allowed on your Main Tenant link (0 = Unlimited)
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                            <label className="block font-bold text-slate-800">Total Tenant Sub Signups</label>
                            <input
                              type="number"
                              min="0"
                              max="1000000"
                              step="1"
                              value={draftMaxTenantSignups}
                              onChange={(e) => setDraftMaxTenantSignups(e.target.value)}
                              className="w-full rounded-xl bg-white border border-slate-200 p-2.5 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                            <span className="text-[10px] text-slate-500 block tabular-nums">
                              Active: {tenantSubTotalSignups} • 0 = Unlimited
                            </span>
                          </div>

                          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                            <label className="block font-bold text-slate-800">Total User Sub Signups</label>
                            <input
                              type="number"
                              min="0"
                              max="1000000"
                              step="1"
                              value={draftMaxUserSignups}
                              onChange={(e) => setDraftMaxUserSignups(e.target.value)}
                              className="w-full rounded-xl bg-white border border-slate-200 p-2.5 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                            <span className="text-[10px] text-slate-500 block tabular-nums">
                              Active: {userSubTotalSignups} • 0 = Unlimited
                            </span>
                          </div>

                          <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-1.5">
                            <label className="block font-bold text-indigo-950 flex items-center gap-1.5">
                              <Store className="h-3.5 w-3.5 text-indigo-600" />
                              <span>Total Company Signups</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="1000000"
                              step="1"
                              value={draftMaxCompanySignups}
                              onChange={(e) => setDraftMaxCompanySignups(e.target.value)}
                              className="w-full rounded-xl bg-white border border-indigo-200 p-2.5 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600"
                            />
                            <span className="text-[10px] text-indigo-700 block tabular-nums">
                              Active: {companySubTotalSignups} • 0 = Unlimited
                            </span>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isSavingTenantConfig}
                          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {isSavingTenantConfig && <Loader2 className="h-4 w-4 animate-spin" />}
                          <span>Save Total Signup Limits</span>
                        </button>
                      </form>

                      {/* Main Tenant: Control Referral Tenants' Total Tenant Sub, User Sub & Company Signups */}
                      <div className="rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-3">
                        <div className="border-b border-slate-100 pb-3">
                          <h3 className="text-base font-extrabold text-slate-900">
                            Referral Tenants — Total Signups Limits
                          </h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Set Tenant Sub, User Sub, and Company Sub signup limits for each Referral Tenant (Referral Tenants default to 10 Companies)
                          </p>
                        </div>

                        {referralTenants.length === 0 ? (
                          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
                            No referral tenants active yet.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {referralTenants.map((rt) => {
                              const draft = referralTenantDrafts[rt.code] || {
                                maxTenant: String(rt.maxTenantSignups),
                                maxUser: String(rt.maxUserSignups),
                                maxCompany: String(rt.maxCompanySignups),
                              };
                              return (
                                <div key={rt.code} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="font-bold text-sm text-slate-900 truncate">{rt.displayName}</div>
                                      <div className="text-[11px] text-slate-500 font-mono truncate tabular-nums">
                                        {rt.code} • Active: {rt.currentTenantSignups}T / {rt.currentUserSignups}U / {rt.currentCompanySignups}C
                                      </div>
                                    </div>
                                    {savedReferralCode === rt.code && (
                                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold shrink-0">
                                        Saved
                                      </span>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
                                    <div>
                                      <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                                        Tenant Sub Signups
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        max="1000000"
                                        value={draft.maxTenant}
                                        onChange={(e) =>
                                          setReferralTenantDrafts((prev) => ({
                                            ...prev,
                                            [rt.code]: { ...draft, maxTenant: e.target.value },
                                          }))
                                        }
                                        className="w-full rounded-xl bg-white border border-slate-200 p-2 text-xs font-semibold text-slate-900"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                                        User Sub Signups
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        max="1000000"
                                        value={draft.maxUser}
                                        onChange={(e) =>
                                          setReferralTenantDrafts((prev) => ({
                                            ...prev,
                                            [rt.code]: { ...draft, maxUser: e.target.value },
                                          }))
                                        }
                                        className="w-full rounded-xl bg-white border border-slate-200 p-2 text-xs font-semibold text-slate-900"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-semibold text-indigo-700 mb-1">
                                        Company Signups
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        max="1000000"
                                        value={draft.maxCompany}
                                        onChange={(e) =>
                                          setReferralTenantDrafts((prev) => ({
                                            ...prev,
                                            [rt.code]: { ...draft, maxCompany: e.target.value },
                                          }))
                                        }
                                        className="w-full rounded-xl bg-white border border-indigo-200 p-2 text-xs font-semibold text-slate-900"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      disabled={savingReferralCode === rt.code}
                                      onClick={() => {
                                        playClickSound();
                                        handleSaveReferralTenantQuota(rt);
                                      }}
                                      className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition disabled:opacity-50"
                                    >
                                      {savingReferralCode === rt.code ? 'Saving...' : 'Set'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
                      <div className="border-b border-slate-100 pb-3">
                        <h3 className="text-base font-extrabold text-slate-900">Your Assigned Signup Limits</h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Referral Tenants can sign up to 10 companies by default; Main Tenant controls total signup caps.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                          <span className="text-[11px] font-semibold text-slate-500 block">Tenant Sub Limit</span>
                          <span className="text-lg font-black text-slate-900 tabular-nums">
                            {myTenantConfig.maxTenantSignups > 0
                              ? `${tenantSubTotalSignups} / ${myTenantConfig.maxTenantSignups}`
                              : `${tenantSubTotalSignups} / Unlimited`}
                          </span>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                          <span className="text-[11px] font-semibold text-slate-500 block">User Sub Limit</span>
                          <span className="text-lg font-black text-slate-900 tabular-nums">
                            {myTenantConfig.maxUserSignups > 0
                              ? `${userSubTotalSignups} / ${myTenantConfig.maxUserSignups}`
                              : `${userSubTotalSignups} / Unlimited`}
                          </span>
                        </div>
                        <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200 space-y-1">
                          <span className="text-[11px] font-semibold text-indigo-700 block">Company Signups Limit</span>
                          <span className="text-lg font-black text-indigo-950 tabular-nums">
                            {myTenantConfig.maxCompanySignups > 0
                              ? `${companySubTotalSignups} / ${myTenantConfig.maxCompanySignups}`
                              : `${companySubTotalSignups} / Unlimited`}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 4: BANK TRANSFER DETAILS */}
              {tenantMenuSection === 'bank' && (
                <form
                  onSubmit={handleSaveTenantConfig}
                  className="rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 text-xs"
                >
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-base font-extrabold text-slate-900">Bank Transfer Details</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Shown to your referrals during onboarding before they upload Proof of Payment
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Bank Name</label>
                      <input
                        type="text"
                        maxLength={120}
                        value={draftBankName}
                        onChange={(e) => setDraftBankName(e.target.value)}
                        placeholder="e.g. FNB / Capitec"
                        className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-slate-900 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Account Holder</label>
                      <input
                        type="text"
                        maxLength={160}
                        value={draftBankAccountHolder}
                        onChange={(e) => setDraftBankAccountHolder(e.target.value)}
                        placeholder="Account name"
                        className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-slate-900 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Account Number</label>
                      <input
                        type="text"
                        maxLength={60}
                        value={draftBankAccountNumber}
                        onChange={(e) => setDraftBankAccountNumber(e.target.value)}
                        placeholder="e.g. 62812345678"
                        className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-slate-900 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Branch Code</label>
                      <input
                        type="text"
                        maxLength={40}
                        value={draftBankBranchCode}
                        onChange={(e) => setDraftBankBranchCode(e.target.value)}
                        placeholder="e.g. 250655"
                        className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-slate-900 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Payment Reference Note</label>
                    <input
                      type="text"
                      maxLength={200}
                      value={draftBankReferenceNote}
                      onChange={(e) => setDraftBankReferenceNote(e.target.value)}
                      placeholder="e.g. Use your full name as reference"
                      className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-slate-900 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingTenantConfig}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isSavingTenantConfig && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>Save Bank Details</span>
                  </button>
                </form>
              )}

              {/* SECTION 5: WORKING HOURS FOR APPROVING SUBMISSIONS */}
              {tenantMenuSection === 'hours' && (
                <form
                  onSubmit={handleSaveTenantConfig}
                  className="rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 text-xs"
                >
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-base font-extrabold text-slate-900">Working Hours for Approving Submissions</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Restrict when referrals can be approved to specific days and hours
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Enable Working Hours Restriction</h4>
                      <p className="text-[11px] text-slate-500">
                        When enabled, approvals outside configured working hours or days will be blocked
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={draftApprovalHoursEnabled}
                      onClick={() => setDraftApprovalHoursEnabled((prev) => !prev)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        draftApprovalHoursEnabled ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          draftApprovalHoursEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {draftApprovalHoursEnabled && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Start Time (24h)</label>
                          <input
                            type="time"
                            value={draftApprovalHoursStart}
                            onChange={(e) => setDraftApprovalHoursStart(e.target.value)}
                            className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-slate-900 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">End Time (24h)</label>
                          <input
                            type="time"
                            value={draftApprovalHoursEnd}
                            onChange={(e) => setDraftApprovalHoursEnd(e.target.value)}
                            className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-slate-900 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Working Days</label>
                        <div className="grid grid-cols-7 gap-1.5 pt-1">
                          {[
                            { id: '1', label: 'Mon' },
                            { id: '2', label: 'Tue' },
                            { id: '3', label: 'Wed' },
                            { id: '4', label: 'Thu' },
                            { id: '5', label: 'Fri' },
                            { id: '6', label: 'Sat' },
                            { id: '0', label: 'Sun' },
                          ].map((day) => {
                            const daysArr = draftApprovalWorkingDays.split(',').map((s) => s.trim());
                            const isSelected = daysArr.includes(day.id);
                            return (
                              <button
                                key={day.id}
                                type="button"
                                onClick={() => {
                                  playClickSound();
                                  let nextArr = [...daysArr];
                                  if (isSelected) {
                                    nextArr = nextArr.filter((d) => d !== day.id);
                                  } else {
                                    nextArr.push(day.id);
                                  }
                                  // Sort standard weekday order: 1,2,3,4,5,6,0
                                  const order = ['1', '2', '3', '4', '5', '6', '0'];
                                  nextArr.sort((a, b) => order.indexOf(a) - order.indexOf(b));
                                  setDraftApprovalWorkingDays(nextArr.filter(Boolean).join(','));
                                }}
                                className={`py-2 rounded-xl text-xs font-bold transition border ${
                                  isSelected
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {day.label}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1.5">
                          Selected days: {draftApprovalWorkingDays ? draftApprovalWorkingDays.split(',').map(d => d === '1' ? 'Mon' : d === '2' ? 'Tue' : d === '3' ? 'Wed' : d === '4' ? 'Thu' : d === '5' ? 'Fri' : d === '6' ? 'Sat' : 'Sun').join(', ') : 'None'}
                        </p>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSavingTenantConfig}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isSavingTenantConfig && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>Save Working Hours</span>
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Bottom Bar inside Full-Screen 3-Bar Menu */}
          <header className="relative z-20 shrink-0 mt-auto border-t border-b-0 shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.15)] bg-white/95 backdrop-blur-md border-slate-200 px-4 py-3">
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {/* Zone 1: Menu Title */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
                  <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                    <Menu className="h-4 w-4" />
                  </div>
                  <span className="text-sm md:text-base font-extrabold text-slate-900 whitespace-nowrap">
                    {isMainTenant ? 'Main Tenant Menu' : 'Tenant Menu'}
                  </span>
                </div>

                <div className="flex sm:hidden items-center gap-2">
                  {tenantConfigSavedMsg && (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold whitespace-nowrap">
                      {tenantConfigSavedMsg}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      playClickSound();
                      setTenantMenuOpen(false);
                    }}
                    className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition whitespace-nowrap"
                  >
                    <X className="h-4 w-4" />
                    <span>Close</span>
                  </button>
                </div>
              </div>

              {/* Zone 2: Separated Section Tabs in the Bottom Bar */}
              <nav className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0">
                {(
                  [
                    { id: 'fees', label: 'Subscription Fees' },
                    { id: 'trials', label: 'Trial Days' },
                    { id: 'limits', label: 'Signup Limits' },
                    { id: 'bank', label: 'Bank Details' },
                    { id: 'hours', label: 'Working Hours' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      playClickSound();
                      setTenantMenuSection(item.id);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition ${
                      tenantMenuSection === item.id
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>

              {/* Zone 3: Primary Close / Saved Indicator (Desktop) */}
              <div className="hidden sm:flex items-center gap-2 shrink-0">
                {tenantConfigSavedMsg && (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold whitespace-nowrap">
                    {tenantConfigSavedMsg}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setTenantMenuOpen(false);
                  }}
                  className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap shrink-0"
                >
                  <X className="h-4 w-4" />
                  <span>Done</span>
                </button>
              </div>
            </div>
          </header>
        </div>
      )}

      {/* Subscription Plan Selection Modal (Single Choice Until Plan Ends) */}
      {upgradeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-200/85 backdrop-blur-md p-4">
          <FloatingToolsWallpaper opacity="opacity-90" />
          <div className="relative z-10 w-full max-w-[360px] max-h-[88vh] overflow-y-auto rounded-3xl bg-gradient-to-b from-white via-slate-50 to-blue-50/30 p-6 shadow-[0_25px_60px_rgba(15,23,42,0.35)] border border-slate-200/95 flex flex-col items-center animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => {
                setStartupSubChooserDismissed(true);
                setUpgradeModalOpen(false);
              }}
              className="absolute top-4 right-4 z-20 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative z-10 flex items-center gap-2 mb-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
                <Crown className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
                Choose Subscription Plan
              </h2>
            </div>

            {isSubscriptionEnded && (
              <div className="relative z-10 w-full mb-3 rounded-2xl bg-rose-50 border border-rose-200 p-3 text-center text-[11px] font-bold text-rose-800">
                Your previous subscription has ended. Choose which subscription plan to activate again.
              </div>
            )}

            {isSubscriptionLocked && (
              <div className="relative z-10 w-full mb-3 rounded-2xl bg-blue-50 border border-blue-200 p-3 text-center text-[11px] font-bold text-blue-900">
                Active Subscription Locked: You cannot switch plans until your current subscription ends.
              </div>
            )}

            {/* Urgent Tenant Spots Reminder */}
            <div className="relative z-10 w-full mb-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 p-3 text-white shadow-lg text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wider">
                <Sparkles className="h-4 w-4 text-yellow-200 animate-spin duration-3000" />
                <span>Tenant spots running out quickly!</span>
              </div>
              <p className="text-[11px] text-amber-100 font-medium mt-0.5">
                {offerConfig.maxTenantSignups > 0
                  ? `Only ${Math.max(0, offerConfig.maxTenantSignups - offerConfig.currentTenantSignups)} of ${offerConfig.maxTenantSignups} spots remain.`
                  : 'Choose 1 plan now. Once your subscription ends, you can decide again.'}
              </p>
            </div>

            <div className="relative z-10 flex flex-col items-center gap-4 w-full">
              {/* Box 1: Tenant Sub */}
              {(() => {
                const isTenantFull =
                  offerConfig.maxTenantSignups > 0 &&
                  offerConfig.currentTenantSignups >= offerConfig.maxTenantSignups;
                const isLockedOther = isSubscriptionLocked && chosenSubscription !== 'tenant';
                const isLockedCurrent =
                  isSubscriptionLocked &&
                  chosenSubscription === 'tenant' &&
                  (mySubmissionStatus !== 'none' || hasActiveTrial);
                const isDisabled = isTenantFull || isLockedOther || isLockedCurrent;

                return (
                  <div
                    onClick={() => !isDisabled && handleSelectSubTier('Tenant Sub (R299.99)')}
                    className={`w-full rounded-2xl bg-gradient-to-br from-white via-slate-50 to-blue-50/60 border-2 p-4 flex flex-col items-center gap-3 text-center transition-all duration-300 relative overflow-hidden group ${
                      isDisabled
                        ? 'opacity-65 cursor-not-allowed border-slate-200 shadow-sm'
                        : startupIntentChoice === 'tenant'
                        ? 'cursor-pointer border-blue-600 ring-2 ring-blue-500/30 shadow-[0_14px_34px_rgba(37,99,235,0.25)] transform hover:-translate-y-1'
                        : 'cursor-pointer border-blue-200 hover:border-blue-600 shadow-[0_12px_30px_rgba(37,99,235,0.18),inset_0_1px_2px_rgba(255,255,255,1)] hover:shadow-[0_20px_45px_rgba(37,99,235,0.3)] transform hover:-translate-y-1'
                    }`}
                  >
                    <div className="w-full flex items-center justify-between px-1">
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1 shadow">
                        <Zap className="h-2.5 w-2.5" /> High Demand
                      </span>
                      {startupIntentChoice === 'tenant' && !isSubscriptionLocked ? (
                        <span className="text-[10px] font-black text-blue-700">Recommended</span>
                      ) : offerConfig.maxTenantSignups > 0 ? (
                        <span className="text-[10px] font-black text-rose-600 tabular-nums">
                          {Math.max(0, offerConfig.maxTenantSignups - offerConfig.currentTenantSignups)} spots left
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-sm font-extrabold text-slate-900">Tenant Sub</h3>
                        <span className="text-base font-black text-blue-600 tabular-nums">
                          R{offerConfig.tenantFee.toFixed(2)}
                          <span className="text-[11px] text-slate-500 font-normal">/mo</span>
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-snug">
                      {isTenantFull
                        ? `Signups full (${offerConfig.currentTenantSignups}/${offerConfig.maxTenantSignups})`
                        : 'Earn passive monthly income from user referral subscriptions'}
                    </p>

                    <button
                      type="button"
                      disabled={isDisabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectSubTier('Tenant Sub (R299.99)');
                      }}
                      className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 shadow-md shadow-blue-600/30 transition disabled:opacity-50"
                    >
                      {isLockedCurrent
                        ? 'Current Active Plan'
                        : isLockedOther
                        ? 'Locked Until Plan Ends'
                        : isTenantFull
                        ? 'Limit Reached'
                        : chosenSubscription === 'tenant' && isSubscriptionLocked
                        ? 'Continue Verification'
                        : 'Select Tenant Sub'}
                    </button>
                  </div>
                );
              })()}

              {/* Box 2: User Sub */}
              {(() => {
                const isUserFull =
                  offerConfig.maxUserSignups > 0 &&
                  offerConfig.currentUserSignups >= offerConfig.maxUserSignups;
                const isLockedOther = isSubscriptionLocked && chosenSubscription !== 'user';
                const isLockedCurrent =
                  isSubscriptionLocked &&
                  chosenSubscription === 'user' &&
                  (mySubmissionStatus !== 'none' || hasActiveTrial);
                const isDisabled = isUserFull || isLockedOther || isLockedCurrent;

                return (
                  <div
                    onClick={() => !isDisabled && handleSelectSubTier('User Sub (R29.99)')}
                    className={`w-full rounded-2xl bg-gradient-to-br from-white via-slate-50 to-purple-50/60 border-2 p-4 flex flex-col items-center gap-3 text-center transition-all duration-300 relative overflow-hidden group ${
                      isDisabled
                        ? 'opacity-65 cursor-not-allowed border-slate-200 shadow-sm'
                        : startupIntentChoice === 'gig'
                        ? 'cursor-pointer border-purple-600 ring-2 ring-purple-500/30 shadow-[0_14px_34px_rgba(147,51,234,0.22)] transform hover:-translate-y-1'
                        : 'cursor-pointer border-purple-200 hover:border-purple-600 shadow-[0_12px_30px_rgba(147,51,234,0.15),inset_0_1px_2px_rgba(255,255,255,1)] hover:shadow-[0_20px_45px_rgba(147,51,234,0.25)] transform hover:-translate-y-1'
                    }`}
                  >
                    {startupIntentChoice === 'gig' && !isSubscriptionLocked && (
                      <div className="w-full text-right px-1">
                        <span className="text-[10px] font-black text-purple-700">Recommended for Posting Gigs</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md">
                        <User className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-sm font-extrabold text-slate-900">User Sub</h3>
                        <span className="text-base font-black text-purple-600 tabular-nums">
                          R{offerConfig.userFee.toFixed(2)}
                          <span className="text-[11px] text-slate-500 font-normal">/mo</span>
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-snug">
                      {isUserFull
                        ? `Signups full (${offerConfig.currentUserSignups}/${offerConfig.maxUserSignups})`
                        : 'Post gigs, hire seekers & refer new users'}
                    </p>

                    <button
                      type="button"
                      disabled={isDisabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectSubTier('User Sub (R29.99)');
                      }}
                      className="w-full py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 shadow-md shadow-purple-600/30 transition disabled:opacity-50"
                    >
                      {isLockedCurrent
                        ? 'Current Active Plan'
                        : isLockedOther
                        ? 'Locked Until Plan Ends'
                        : isUserFull
                        ? 'Limit Reached'
                        : chosenSubscription === 'user' && isSubscriptionLocked
                        ? 'Continue Verification'
                        : 'Select User Sub'}
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Advanced & Simple Verification & Onboarding Modal (Any Size File Support) */}
      {onboardingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 md:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200 max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setOnboardingModalOpen(false)}
              className="absolute top-4 right-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-5 text-center">
              <span className="px-3.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-extrabold uppercase tracking-wider">
                {selectedSubTier?.includes('Tenant')
                  ? `Tenant Sub (R${offerConfig.tenantFee.toFixed(2)}/mo)`
                  : selectedSubTier?.includes('Company')
                  ? `Company Sub (R${offerConfig.companyFee.toFixed(2)}/mo)`
                  : `User Sub (R${offerConfig.userFee.toFixed(2)}/mo)`}
              </span>
              <h2 className="text-xl font-black text-slate-900 mt-2">Verification &amp; Onboarding</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete 3 simple steps to activate your subscription and secure your account
              </p>
            </div>

            {selectedSubTier?.includes('Tenant') && (
              <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 flex items-center gap-3 text-xs text-amber-950 shadow-sm">
                <Sparkles className="h-5 w-5 text-amber-600 shrink-0" />
                <div className="min-w-0">
                  <span className="font-bold block text-xs uppercase tracking-wide text-amber-900">
                    Tenant Spot Temporarily Held!
                  </span>
                  <span className="text-[11px] text-amber-800 block mt-0.5">
                    Tenant spots are running out quickly. Submit your verification now to finalize and secure your spot.
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={handleFinalSubmitReview} className="space-y-4 text-xs">
              {/* Step Indicator Header */}
              <div className="grid grid-cols-3 gap-2 pb-2 border-b border-slate-100 text-[11px] font-bold text-slate-600 text-center">
                <div className={`p-2 rounded-xl border ${selfieCaptured ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-blue-50 border-blue-300 text-blue-800'}`}>
                  1. Face Selfie {selfieCaptured ? '✓' : ''}
                </div>
                <div className={`p-2 rounded-xl border ${idUploaded ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                  2. ID Document {idUploaded ? '✓' : ''}
                </div>
                <div className={`p-2 rounded-xl border ${popUploaded ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                  3. POP Receipt {popUploaded ? '✓' : ''}
                </div>
              </div>

              {/* Step 1: Live Face Selfie */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  {selfieDataUrl ? (
                    <img src={selfieDataUrl} alt="Selfie" className="h-12 w-12 rounded-xl object-cover border-2 border-emerald-500 shadow-sm" />
                  ) : (
                    <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <Camera className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Step 1: Live Face Selfie</h4>
                    <p className="text-[11px] text-slate-500">{selfieCaptured ? 'Captured & verified successfully' : 'Capture clear face selfie for your profile card'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={startCamera}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                    selfieCaptured ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-blue-600 text-white hover:bg-blue-500'
                  }`}
                >
                  {selfieCaptured ? 'Retake Selfie' : 'Capture Selfie'}
                </button>
              </div>

              {/* Step 2: ID Document Upload (Any Size) */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  {idDocFile?.url && idDocFile.type.startsWith('image/') ? (
                    <img src={idDocFile.url} alt="ID preview" className="h-12 w-12 rounded-xl object-cover border-2 border-purple-500 shrink-0 shadow-sm" />
                  ) : (
                    <div className="h-12 w-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                      {idDocFile ? <FileText className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 text-sm">Step 2: ID Document</h4>
                    <p className="text-[11px] text-slate-500 truncate">
                      {idDocFile ? `${idDocFile.name} (${idDocFile.size})` : 'Passport, ID card or Driver Licence (Any size)'}
                    </p>
                  </div>
                </div>
                <label className="cursor-pointer px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 transition shrink-0 ml-2 shadow-sm">
                  <span>{idUploaded ? 'Change File' : 'Upload ID'}</span>
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleIdFileUpload} />
                </label>
              </div>

              {/* Bank Transfer Details Box */}
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 space-y-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-blue-950 flex items-center gap-1.5 text-xs">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    <span>Bank Transfer Payment Details</span>
                  </h4>
                  {offerConfig.bankAccountNumber && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(offerConfig.bankAccountNumber).catch(() => {});
                        setCopiedBankAcct(true);
                        setTimeout(() => setCopiedBankAcct(false), 2000);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center gap-1 transition shadow-sm"
                    >
                      {copiedBankAcct ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedBankAcct ? 'Copied Account' : 'Copy Account'}</span>
                    </button>
                  )}
                </div>
                {offerConfig.bankName || offerConfig.bankAccountNumber || offerConfig.bankAccountHolder ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-700 pt-1">
                    {offerConfig.bankName && (
                      <div>
                        <span className="text-slate-500">Bank: </span>
                        <span className="font-bold text-slate-900">{offerConfig.bankName}</span>
                      </div>
                    )}
                    {offerConfig.bankAccountHolder && (
                      <div>
                        <span className="text-slate-500">Holder: </span>
                        <span className="font-bold text-slate-900">{offerConfig.bankAccountHolder}</span>
                      </div>
                    )}
                    {offerConfig.bankAccountNumber && (
                      <div>
                        <span className="text-slate-500">Account: </span>
                        <span className="font-bold text-slate-900">{offerConfig.bankAccountNumber}</span>
                      </div>
                    )}
                    {offerConfig.bankBranchCode && (
                      <div>
                        <span className="text-slate-500">Branch: </span>
                        <span className="font-bold text-slate-900">{offerConfig.bankBranchCode}</span>
                      </div>
                    )}
                    {offerConfig.bankReferenceNote && (
                      <div className="col-span-2">
                        <span className="text-slate-500">Reference: </span>
                        <span className="font-bold text-blue-900">{offerConfig.bankReferenceNote}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-blue-800">
                    Please use your referrer tenant bank transfer details to make payment before uploading Proof of Payment.
                  </p>
                )}
              </div>

              {/* Step 3: Proof of Payment (Any Size) */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  {popDocFile?.url && popDocFile.type.startsWith('image/') ? (
                    <img src={popDocFile.url} alt="POP preview" className="h-12 w-12 rounded-xl object-cover border-2 border-emerald-500 shrink-0 shadow-sm" />
                  ) : (
                    <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      {popDocFile ? <FileText className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 text-sm">Step 3: Proof of Payment</h4>
                    <p className="text-[11px] text-slate-500 truncate">
                      {popDocFile ? `${popDocFile.name} (${popDocFile.size})` : 'EFT receipt or POP slip (Any size)'}
                    </p>
                  </div>
                </div>
                <label className="cursor-pointer px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition shrink-0 ml-2 shadow-sm">
                  <span>{popUploaded ? 'Change File' : 'Upload POP'}</span>
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handlePopFileUpload} />
                </label>
              </div>

              <div className="rounded-2xl bg-amber-50 p-3.5 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Review takes about 15 to 25 minutes after submission by your referrer tenant.</span>
              </div>

              <button
                type="submit"
                disabled={!selfieCaptured || !idUploaded || !popUploaded || isSubmittingReview}
                className="w-full py-3.5 rounded-2xl bg-blue-600 text-white text-sm font-extrabold hover:bg-blue-500 shadow-xl shadow-blue-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmittingReview && <Loader2 className="h-5 w-5 animate-spin" />}
                <span>Submit Verification for Review (15-25 mins)</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Startup Intent Prompt (New Signups Only: Post a Gig vs Become a Tenant, plus Already Registered Login) */}
      {startupIntentOpen && !isAuthenticated && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-gray-200/85 backdrop-blur-md p-4">
          <FloatingToolsWallpaper opacity="opacity-95" />
          <div className="relative z-10 w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl bg-white/95 p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="text-center space-y-1.5">
              <span className="text-xs font-extrabold uppercase tracking-widest text-blue-600">TimeGiG</span>
              <h2 className="text-2xl font-black text-slate-900">What would you like to do?</h2>
              <p className="text-xs text-slate-600">
                Choose your goal to sign up, or log in directly if you already have an account.
              </p>
              {pendingRefCode && (
                <p className="text-[11px] font-semibold text-emerald-700 pt-0.5">
                  Referral code attached: {pendingRefCode}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  setStartupIntentChoice('gig');
                  setHasCompletedStartupIntent(true);
                  setStartupIntentOpen(false);
                  setAuthTab('signup');
                  setAuthError(null);
                  setAuthModalOpen(true);
                }}
                className="min-h-[120px] rounded-2xl bg-slate-50 hover:bg-blue-50 border-2 border-slate-200 hover:border-blue-600 p-4 text-left flex flex-col justify-between gap-3 transition shadow-sm active:scale-[0.98]"
              >
                <div className="h-11 w-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/25">
                  <Zap className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-slate-900">Post a Gig</h3>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Post gigs on the map, hire local seekers for services, and manage jobs.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  setStartupIntentChoice('tenant');
                  setHasCompletedStartupIntent(true);
                  setStartupIntentOpen(false);
                  setAuthTab('signup');
                  setAuthError(null);
                  setAuthModalOpen(true);
                }}
                className="min-h-[120px] rounded-2xl bg-slate-50 hover:bg-amber-50 border-2 border-slate-200 hover:border-amber-500 p-4 text-left flex flex-col justify-between gap-3 transition shadow-sm active:scale-[0.98]"
              >
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-md shadow-amber-500/25">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-slate-900">Become a Tenant</h3>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Earn a passive monthly income through user referral subscriptions.
                  </p>
                </div>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-200 flex flex-col items-center gap-2 text-center">
              <p className="text-[11px] text-slate-500">Already registered on TimeGiG?</p>
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  setStartupIntentChoice(null);
                  setHasCompletedStartupIntent(true);
                  setStartupIntentOpen(false);
                  setAuthTab('signin');
                  setAuthError(null);
                  setAuthModalOpen(true);
                }}
                className="w-full min-h-[44px] rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md transition"
              >
                Already Registered? Login
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Congratulations Modal After New Signup & Terms Acceptance */}
      {congratsModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-gray-200/85 backdrop-blur-md p-4">
          <FloatingToolsWallpaper opacity="opacity-95" />
          <div className="relative z-10 w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl border border-slate-200 text-center space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-600/25 flex items-center justify-center">
              <PartyPopper className="h-8 w-8" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-2xl font-black text-slate-900">Congratulations!</h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Welcome to <span className="font-bold text-slate-900">TimeGiG</span>! Your account has been created and you have accepted our Terms &amp; Conditions.
              </p>
              {(activeReferrer?.code || pendingRefCode) && (
                <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                  Referral attached: {activeReferrer?.code || pendingRefCode}
                </p>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Next, choose 1 subscription plan to activate your access. You cannot switch plans mid-term, and when your subscription ends you can decide again.
            </p>
            <button
              type="button"
              onClick={() => {
                playClickSound();
                setCongratsModalOpen(false);
                setStartupSubChooserDismissed(false);
                setUpgradeModalOpen(true);
              }}
              className="w-full min-h-[46px] rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-extrabold shadow-lg shadow-blue-600/30 transition"
            >
              Continue to Subscription Plans
            </button>
          </div>
        </div>
      )}

      {/* Auth Modal (Signup / Signin with Mandatory T&C on New Signup) */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-200/85 backdrop-blur-md p-4">
          {!isAuthenticated && <FloatingToolsWallpaper opacity="opacity-95" />}
          <div className="relative z-10 w-full max-w-md max-h-[92vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200">
            {isAuthenticated && (
              <button
                onClick={() => setAuthModalOpen(false)}
                className="absolute top-4 right-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {/* Mode Switcher Tabs */}
            <div className="mb-5 flex rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthTab('signup');
                  setAuthError(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                  authTab === 'signup'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign Up
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab('signin');
                  setAuthError(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                  authTab === 'signin'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
            </div>

            <div className="mb-4 text-center">
              <h2 className="text-xl font-bold text-slate-900">
                {authTab === 'signup' ? 'Create Your Account' : 'Welcome Back'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {authTab === 'signup'
                  ? pendingRefCode
                    ? 'New referral! Sign up and accept Terms & Conditions to continue.'
                    : 'Sign up and accept Terms & Conditions to choose your subscription plan.'
                  : 'Already registered? Sign in to access your account.'}
              </p>
              {authTab === 'signup' && startupIntentChoice && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200 px-3 py-1 text-[11px] font-bold text-blue-800">
                  <span>
                    Goal: {startupIntentChoice === 'tenant' ? 'Become a Tenant (Passive Income)' : 'Post a Gig'}
                  </span>
                  {!isAuthenticated && (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthModalOpen(false);
                        setHasCompletedStartupIntent(false);
                        setStartupIntentOpen(true);
                      }}
                      className="underline text-blue-600 hover:text-blue-700"
                    >
                      Change
                    </button>
                  )}
                </div>
              )}
              {pendingRefCode && (
                <p className="text-[11px] font-semibold text-blue-600 mt-1.5">
                  Referral code attached: {pendingRefCode}
                </p>
              )}
            </div>

            {/* Urgency Reminder for New Signups */}
            <div className="mb-4 rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 border border-amber-200/90 p-3 text-left flex items-start gap-2.5 shadow-sm">
              <div className="p-1.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shrink-0 mt-0.5 shadow">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="text-[11px] font-black text-amber-950 uppercase tracking-wide">
                    Tenant spots are running out quickly!
                  </h4>
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[8px] font-black uppercase">
                    Urgent
                  </span>
                </div>
                <p className="text-[10px] text-amber-900 leading-snug mt-0.5">
                  {offerConfig.maxTenantSignups > 0
                    ? `Only ${Math.max(0, offerConfig.maxTenantSignups - offerConfig.currentTenantSignups)} of ${offerConfig.maxTenantSignups} spots remain before registration closes.`
                    : 'Limited spots available. Sign up now and select your subscription plan.'}
                </p>
              </div>
            </div>

            {authError && (
              <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <div className="space-y-4">
              {authTab === 'signup' && (
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 space-y-2 text-left">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => {
                        setAcceptedTerms(e.target.checked);
                        if (e.target.checked) setAuthError(null);
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 shrink-0"
                    />
                    <span className="text-[11px] text-slate-700 leading-snug">
                      I accept the{' '}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setTermsDetailsOpen((prev) => !prev);
                        }}
                        className="font-bold text-blue-600 underline hover:text-blue-500 inline-flex items-center gap-1"
                      >
                        <FileCheck2 className="h-3 w-3" />
                        <span>Terms &amp; Conditions</span>
                      </button>{' '}
                      for TimeGiG.
                    </span>
                  </label>

                  {termsDetailsOpen && (
                    <div className="rounded-xl bg-white border border-slate-200 p-2.5 text-[10px] text-slate-600 leading-relaxed space-y-1 max-h-28 overflow-y-auto">
                      <p className="font-bold text-slate-800">TimeGiG Terms &amp; Conditions Summary</p>
                      <p>1. Users may select 1 subscription plan at a time and cannot switch plans until the active plan ends.</p>
                      <p>2. Valid verification details (selfie, ID, and proof of payment) are required to activate paid subscriptions.</p>
                      <p>3. Referral submissions are reviewed by the assigned Tenant or Main Tenant ({MAIN_TENANT_EMAIL}).</p>
                    </div>
                  )}
                </div>
              )}

              {/* Google Sign In Button */}
              <button
                type="button"
                disabled={isAuthLoading}
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-3 rounded-xl bg-white border border-slate-300 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition disabled:opacity-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.19v3.15C3.17 21.32 7.23 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.19C.43 8.12 0 9.87 0 11.75s.43 3.63 1.19 5.17l4.09-2.65z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.17 2.68 1.19 6.58l4.09 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>{authTab === 'signup' ? 'Sign Up with Google' : 'Continue with Google'}</span>
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-slate-400 text-[11px]">or with email</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full rounded-xl bg-slate-50 border border-slate-200 py-3 pl-10 pr-4 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl bg-slate-50 border border-slate-200 py-3 pl-10 pr-4 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isAuthLoading}
                  className="w-full rounded-xl bg-blue-600 py-3 text-xs font-bold text-white hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
                >
                  {isAuthLoading
                    ? (authTab === 'signup' ? 'Creating Account...' : 'Signing In...')
                    : (authTab === 'signup' ? 'Accept & Sign Up' : 'Sign In & Continue')}
                </button>
              </form>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab(authTab === 'signup' ? 'signin' : 'signup');
                    setAuthError(null);
                  }}
                  className="text-xs text-slate-600 hover:text-blue-600 font-medium transition"
                >
                  {authTab === 'signup' ? (
                    <>Already have an account? <span className="font-bold text-blue-600 underline">Sign In</span></>
                  ) : (
                    <>Don&apos;t have an account? <span className="font-bold text-blue-600 underline">Sign Up</span></>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Camera Preview Modal */}
      {cameraModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <button
              onClick={stopCamera}
              className="absolute top-4 right-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-base font-bold text-slate-900">Capture Live Face Selfie</h3>
            <p className="text-xs text-slate-500">Position your face in the frame and click capture</p>
            
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-inner border border-slate-300">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <button
              type="button"
              onClick={capturePhoto}
              className="w-full py-3 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2"
            >
              <Camera className="h-4 w-4" />
              <span>Capture Photo</span>
            </button>
          </div>
        </div>
      )}

      {/* Full-Screen Submission Review Modal (Face Selfie & Documents Inspection) */}
      {viewingSubmission && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4 overflow-y-auto">
          <div className="relative w-full max-w-3xl rounded-3xl bg-white p-6 md:p-8 shadow-2xl border border-slate-200 space-y-6 my-auto">
            <button
              onClick={() => setViewingSubmission(null)}
              className="absolute top-4 right-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="border-b border-slate-100 pb-4">
              <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider">{viewingSubmission.subType}</span>
              <h2 className="text-xl font-black text-slate-900 mt-2">{viewingSubmission.userName}</h2>
              <p className="text-xs text-slate-500">{viewingSubmission.userEmail} • Submitted at {new Date(viewingSubmission.submittedAt).toLocaleString()}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Face Selfie Fullscreen View */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
                    <Camera className="h-4 w-4 text-blue-600" />
                    <span>Face Selfie</span>
                  </h4>
                  {viewingSubmission.selfie && (
                    <button
                      type="button"
                      onClick={() => setLightboxDoc({
                        title: 'Live Face Selfie',
                        name: `${viewingSubmission.userName}'s Verification Selfie`,
                        url: viewingSubmission.selfie!,
                        isImage: true
                      })}
                      className="text-[10px] text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-md"
                    >
                      <Maximize2 className="h-3 w-3" />
                      <span>Inspect</span>
                    </button>
                  )}
                </div>
                <div 
                  onClick={() => viewingSubmission.selfie && setLightboxDoc({
                    title: 'Live Face Selfie',
                    name: `${viewingSubmission.userName}'s Verification Selfie`,
                    url: viewingSubmission.selfie,
                    isImage: true
                  })}
                  className="w-full aspect-3/4 rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 flex items-center justify-center shadow-inner relative group cursor-pointer"
                >
                  {viewingSubmission.selfie && viewingSubmission.selfie.startsWith('data:image') ? (
                    <>
                      <img src={viewingSubmission.selfie} alt="Face Selfie" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center text-white text-xs font-bold gap-1">
                        <Eye className="h-5 w-5" />
                        <span>Click to Inspect Full Screen</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-4">
                      <User className="h-12 w-12 text-slate-400 mx-auto mb-2" />
                      <span className="text-xs font-semibold text-slate-300">Face Verified</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ID Document Fullscreen View */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-purple-600" />
                    <span>ID Document</span>
                  </h4>
                  {viewingSubmission.idDoc?.url && (
                    <button
                      type="button"
                      onClick={() => setLightboxDoc({
                        title: 'Official ID Document',
                        name: viewingSubmission.idDoc!.name,
                        url: viewingSubmission.idDoc!.url,
                        isImage: viewingSubmission.idDoc!.type.startsWith('image/')
                      })}
                      className="text-[10px] text-purple-600 hover:text-purple-700 font-bold flex items-center gap-1 bg-purple-50 px-2 py-0.5 rounded-md"
                    >
                      <Maximize2 className="h-3 w-3" />
                      <span>Inspect</span>
                    </button>
                  )}
                </div>
                <div
                  onClick={() => viewingSubmission.idDoc?.url && setLightboxDoc({
                    title: 'Official ID Document',
                    name: viewingSubmission.idDoc.name,
                    url: viewingSubmission.idDoc.url,
                    isImage: viewingSubmission.idDoc.type.startsWith('image/')
                  })}
                  className="w-full aspect-3/4 rounded-2xl overflow-hidden bg-slate-50 border border-slate-200 flex flex-col items-center justify-center p-2 text-center shadow-inner relative group cursor-pointer"
                >
                  {viewingSubmission.idDoc?.url && viewingSubmission.idDoc.type.startsWith('image/') ? (
                    <>
                      <img src={viewingSubmission.idDoc.url} alt="ID Document" className="w-full h-full object-contain rounded-xl" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center text-white text-xs font-bold gap-1">
                        <Eye className="h-5 w-5" />
                        <span>Click to Inspect Full Screen</span>
                      </div>
                    </>
                  ) : viewingSubmission.idDoc?.url && viewingSubmission.idDoc.type === 'application/pdf' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-purple-50/60 rounded-xl">
                      <FileText className="h-12 w-12 text-purple-600 mb-2" />
                      <span className="text-xs font-bold text-purple-900 line-clamp-2">{viewingSubmission.idDoc.name}</span>
                      <span className="text-[10px] text-purple-600 mt-1">{viewingSubmission.idDoc.size || 'PDF Document'}</span>
                      <span className="mt-3 px-3 py-1.5 rounded-xl bg-purple-600 text-white text-[10px] font-bold shadow-sm">Inspect Full Document</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4">
                      <Shield className="h-12 w-12 text-purple-400 mb-2" />
                      <span className="text-xs font-bold text-slate-800">{viewingSubmission.idDoc?.name || 'national_id_document.pdf'}</span>
                      <span className="text-[10px] text-slate-500 mt-1">Official ID / Passport</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Proof of Payment Fullscreen View */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Proof of Payment</span>
                  </h4>
                  {viewingSubmission.popDoc?.url && (
                    <button
                      type="button"
                      onClick={() => setLightboxDoc({
                        title: 'Proof of Payment Receipt',
                        name: viewingSubmission.popDoc!.name,
                        url: viewingSubmission.popDoc!.url,
                        isImage: viewingSubmission.popDoc!.type.startsWith('image/')
                      })}
                      className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md"
                    >
                      <Maximize2 className="h-3 w-3" />
                      <span>Inspect</span>
                    </button>
                  )}
                </div>
                <div
                  onClick={() => viewingSubmission.popDoc?.url && setLightboxDoc({
                    title: 'Proof of Payment Receipt',
                    name: viewingSubmission.popDoc.name,
                    url: viewingSubmission.popDoc.url,
                    isImage: viewingSubmission.popDoc.type.startsWith('image/')
                  })}
                  className="w-full aspect-3/4 rounded-2xl overflow-hidden bg-slate-50 border border-slate-200 flex flex-col items-center justify-center p-2 text-center shadow-inner relative group cursor-pointer"
                >
                  {viewingSubmission.popDoc?.url && viewingSubmission.popDoc.type.startsWith('image/') ? (
                    <>
                      <img src={viewingSubmission.popDoc.url} alt="Proof of Payment" className="w-full h-full object-contain rounded-xl" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center text-white text-xs font-bold gap-1">
                        <Eye className="h-5 w-5" />
                        <span>Click to Inspect Full Screen</span>
                      </div>
                    </>
                  ) : viewingSubmission.popDoc?.url && viewingSubmission.popDoc.type === 'application/pdf' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-emerald-50/60 rounded-xl">
                      <FileText className="h-12 w-12 text-emerald-600 mb-2" />
                      <span className="text-xs font-bold text-emerald-900 line-clamp-2">{viewingSubmission.popDoc.name}</span>
                      <span className="text-[10px] text-emerald-600 mt-1">{viewingSubmission.popDoc.size || 'Bank EFT PDF'}</span>
                      <span className="mt-3 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-[10px] font-bold shadow-sm">Inspect Full Document</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4">
                      <CheckCircle2 className="h-12 w-12 text-emerald-400 mb-2" />
                      <span className="text-xs font-bold text-slate-800">{viewingSubmission.popDoc?.name || 'proof_of_payment.pdf'}</span>
                      <span className="text-[10px] text-slate-500 mt-1">Bank Receipt Attached</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Subscription Expiry & Referrer Decision Banner */}
            {(() => {
              const modalExpiry = getSubscriptionExpiryState(viewingSubmission);
              const modalCanDecide = canDecideSubmission(viewingSubmission);
              return (
                <>
                  {modalExpiry.isRedAlert && (
                    <div className="rounded-2xl bg-rose-50 border-2 border-rose-500 px-4 py-3 flex items-start gap-2.5 text-xs text-rose-900">
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-extrabold">
                          {modalExpiry.isExpired
                            ? 'Subscription Has Ended'
                            : `Subscription Close to End (${modalExpiry.daysLeft} day${modalExpiry.daysLeft === 1 ? '' : 's'} left)`}
                        </p>
                        <p className="text-[11px] text-rose-700 mt-0.5">
                          Only the Referrer Tenant can decide whether to renew, freeze, or end this subscription.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Decision Actions (Referrer Tenant Only) */}
                  <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100">
                    {!modalCanDecide ? (
                      <span className="text-xs font-semibold text-slate-500 mr-auto">
                        Only the Referrer Tenant can decide on this referral subscription.
                      </span>
                    ) : (
                      <>
                        {viewingSubmission.status === 'approved' && (
                          <>
                            <button
                              onClick={() => {
                                handleExtendSubmission(viewingSubmission, 30);
                                setViewingSubmission(null);
                              }}
                              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md flex items-center gap-1.5"
                            >
                              <Plus className="h-4 w-4" />
                              <span>Renew +30 Days</span>
                            </button>
                            <button
                              onClick={() => {
                                handleFreezeSubmission(viewingSubmission);
                                setViewingSubmission(null);
                              }}
                              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-md flex items-center gap-1.5"
                            >
                              <Snowflake className="h-4 w-4" />
                              <span>Freeze Account</span>
                            </button>
                          </>
                        )}
                        {viewingSubmission.status === 'frozen' && (
                          <button
                            onClick={() => {
                              handleUnfreezeSubmission(viewingSubmission);
                              setViewingSubmission(null);
                            }}
                            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Unfreeze Account</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            handleRejectSubmission(viewingSubmission);
                            setViewingSubmission(null);
                          }}
                          className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-md flex items-center gap-1.5"
                        >
                          <XCircle className="h-4 w-4" />
                          <span>{viewingSubmission.status === 'approved' ? 'End / Reject' : 'Reject Submission'}</span>
                        </button>
                        {viewingSubmission.status !== 'approved' && (
                          <button
                            onClick={() => {
                              handleApproveSubmission(viewingSubmission);
                              setViewingSubmission(null);
                            }}
                            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Approve Submission</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Dedicated High-Res Full-Screen Document Lightbox Inspector */}
      {lightboxDoc && (
        <div className="fixed inset-0 z-80 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-2xl p-4 md:p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-4xl flex items-center justify-between text-white pb-3 border-b border-white/10 mb-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/10 text-white">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm md:text-base font-bold text-white">{lightboxDoc.title}</h3>
                <p className="text-xs text-white/60">{lightboxDoc.name}</p>
              </div>
            </div>
            <button
              onClick={() => setLightboxDoc(null)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
              title="Close Full Screen View"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="relative w-full max-w-4xl flex-1 flex items-center justify-center overflow-auto rounded-3xl bg-black/40 border border-white/10 p-2 md:p-4">
            {lightboxDoc.isImage ? (
              <img
                src={lightboxDoc.url}
                alt={lightboxDoc.title}
                className="max-h-[75vh] max-w-full object-contain rounded-2xl shadow-2xl"
              />
            ) : (
              <iframe
                src={lightboxDoc.url}
                title={lightboxDoc.title}
                className="w-full h-[75vh] rounded-2xl bg-white shadow-2xl"
              />
            )}
          </div>
        </div>
      )}

      {/* Hire Seeker Confirmation Modal */}
      {hireModalSeeker && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <form onSubmit={handleConfirmHire} className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <button
              type="button"
              onClick={() => setHireModalSeeker(null)}
              className="absolute top-4 right-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Hire {hireModalSeeker.displayName}</h3>
              <p className="text-xs text-slate-500">
                {hireModalSeeker.serviceTitle || 'General Service'} {hireModalSeeker.serviceRate ? `• ${hireModalSeeker.serviceRate}` : ''}
              </p>
            </div>
            <div className="text-xs space-y-1.5">
              <label className="block font-semibold text-slate-700">Your Destination Address</label>
              <input
                type="text"
                required
                value={hireDestAddress}
                onChange={(e) => setHireDestAddress(e.target.value)}
                placeholder="Enter destination address..."
                className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <span className="text-[10px] text-slate-400 block">
                Pin: {hireDestLat.toFixed(5)}, {hireDestLng.toFixed(5)}
              </span>
            </div>
            <button
              type="submit"
              disabled={isSendingHire}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition disabled:opacity-50"
            >
              {isSendingHire ? 'Sending Request...' : 'Confirm & Hire Seeker'}
            </button>
          </form>
        </div>
      )}

      {/* Circle Loading Overlay (User waiting for Seeker to accept) */}
      {activePendingOutgoing && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 flex flex-col items-center text-center space-y-4">
            <div className="h-14 w-14 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Waiting for {activePendingOutgoing.seekerName}</h3>
              <p className="text-xs text-slate-500 mt-1">
                Waiting for seeker to accept your hire for {activePendingOutgoing.serviceTitle}...
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                playClickSound();
                setCancelReasonInput('');
                setCancelModalHire(activePendingOutgoing);
              }}
              className="w-full py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold transition"
            >
              Cancel Request
            </button>
          </div>
        </div>
      )}

      {/* Incoming Hire Request Prompt for Seeker */}
      {activePendingIncoming && !activePendingOutgoing && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-55 w-11/12 max-w-md rounded-3xl bg-white p-5 shadow-2xl border-2 border-blue-500 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold uppercase">
                Incoming Hire Request
              </span>
              <h3 className="text-sm font-bold text-slate-900 mt-1">
                {activePendingIncoming.userName} wants to hire you
              </h3>
              <p className="text-xs text-slate-600">
                {activePendingIncoming.serviceTitle} {activePendingIncoming.serviceRate ? `(${activePendingIncoming.serviceRate})` : ''}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Destination: {activePendingIncoming.destAddress}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                playClickSound();
                handleAcceptHire(activePendingIncoming);
              }}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition"
            >
              Accept & Navigate
            </button>
            <button
              type="button"
              onClick={() => {
                playClickSound();
                setCancelReasonInput('');
                setCancelModalHire(activePendingIncoming);
              }}
              className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Star Rating & Completion Modal (Only User can trigger) */}
      {ratingModalHire && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <form onSubmit={handleCompleteHire} className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 text-center">
            <button
              type="button"
              onClick={() => setRatingModalHire(null)}
              className="absolute top-4 right-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
            <div>
              <h3 className="text-base font-bold text-slate-900">Rate {ratingModalHire.seekerName}</h3>
              <p className="text-xs text-slate-500">Confirm gig completed & give a star rating</p>
            </div>
            <div className="flex items-center justify-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setRatingValue(star);
                  }}
                  className="p-1 transition transform hover:scale-110"
                >
                  <Star
                    className={`h-8 w-8 ${
                      star <= ratingValue ? 'fill-amber-400 text-amber-500' : 'text-slate-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            <input
              type="text"
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              placeholder="Optional feedback..."
              className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button
              type="submit"
              disabled={isCompletingHire}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition disabled:opacity-50"
            >
              {isCompletingHire ? 'Submitting...' : 'Submit Rating & Complete'}
            </button>
          </form>
        </div>
      )}

      {/* Mandatory Cancel Reason Modal (User or Seeker) */}
      {cancelModalHire && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <form onSubmit={handleCancelHireSubmit} className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <button
              type="button"
              onClick={() => setCancelModalHire(null)}
              className="absolute top-4 right-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
            <div>
              <h3 className="text-base font-bold text-slate-900">Cancel Gig</h3>
              <p className="text-xs text-slate-500">
                Please provide a reason for cancelling with{' '}
                {currentUser?.uid === cancelModalHire.userId ? cancelModalHire.seekerName : cancelModalHire.userName}.
              </p>
            </div>
            <textarea
              required
              rows={3}
              value={cancelReasonInput}
              onChange={(e) => setCancelReasonInput(e.target.value)}
              placeholder="Enter cancellation reason..."
              className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <button
              type="submit"
              disabled={isCancellingHire || !cancelReasonInput.trim()}
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md transition disabled:opacity-50"
            >
              {isCancellingHire ? 'Cancelling...' : 'Confirm Cancellation'}
            </button>
          </form>
        </div>
      )}

      {/* Cancellation Reason Notice Modal (shown to both User & Seeker) */}
      {cancelledNoticeHire && (
        <div className="fixed inset-0 z-65 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-rose-200 space-y-3 text-center">
            <div className="mx-auto h-10 w-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Gig Cancelled</h3>
            <p className="text-xs text-slate-600">
              Cancelled by{' '}
              <span className="font-bold">
                {cancelledNoticeHire.cancelledBy === 'user' ? cancelledNoticeHire.userName : cancelledNoticeHire.seekerName}
              </span>
            </p>
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-xs text-rose-800">
              Reason: &ldquo;{cancelledNoticeHire.cancelReason || 'No reason provided'}&rdquo;
            </div>
            <button
              type="button"
              onClick={() => setCancelledNoticeHire(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Create / Edit Gig Modal */}
      {gigFormOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <form onSubmit={handleSaveGig} className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-3.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setGigFormOpen(false);
                setEditingGig(null);
              }}
              className="absolute top-4 right-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 pr-6">
              <div className="h-11 w-11 rounded-full overflow-hidden bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0 font-bold text-xs">
                {myAvatarThumb && myAvatarThumb.startsWith('data:image/') ? (
                  <img src={myAvatarThumb} alt="Your Face Selfie" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900">
                  {editingGig ? 'Edit Your Gig Post' : 'Create & Post a Gig'}
                </h3>
                <p className="text-[11px] text-slate-500 truncate">
                  {myAvatarThumb ? 'Face selfie attached to gig post' : 'Add a face selfie for your gig post'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  startCamera();
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 border border-slate-200 text-[10px] font-bold flex items-center gap-1 shrink-0 transition"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>{myAvatarThumb ? 'Retake' : 'Selfie'}</span>
              </button>
            </div>

            <div className="relative">
              <label className="block font-semibold text-slate-700 mb-1">Gig Location</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  value={gigLocationName}
                  onChange={(e) => handleGigLocationType(e.target.value)}
                  placeholder="Type street, suburb, city..."
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="button"
                  onClick={() => {
                    setGigFormOpen(false);
                    setActiveTab('gigs');
                    setIsPickingGigLocation(true);
                  }}
                  className="px-2.5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold shrink-0"
                >
                  Pick Map
                </button>
              </div>
              {gigLocationSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 max-h-40 overflow-y-auto rounded-xl bg-white shadow-xl border border-slate-200 z-50">
                  {gigLocationSuggestions.map((s) => (
                    <button
                      key={s.place_id}
                      type="button"
                      onClick={() => {
                        const lat = parseFloat(s.lat);
                        const lng = parseFloat(s.lon);
                        setGigLat(lat);
                        setGigLng(lng);
                        setGigLocationName(s.display_name);
                        setGigLocationPicked(true);
                        setGigLocationSuggestions([]);
                        if (mapInstanceRef.current) {
                          mapInstanceRef.current.flyTo([lat, lng], 15, { animate: true, duration: 0.8 });
                        }
                      }}
                      className="w-full text-left px-3 py-2 text-[11px] text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-start gap-2"
                    >
                      <MapPin className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{s.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Gig Title</label>
              <input
                type="text"
                required
                value={gigTitle}
                onChange={(e) => setGigTitle(e.target.value)}
                placeholder="e.g. Fix Kitchen Sink, Lawn Mowing..."
                className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pay / Budget</label>
                <input
                  type="text"
                  required
                  value={gigPay}
                  onChange={(e) => setGigPay(e.target.value)}
                  placeholder="e.g. R300"
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <input
                  type="text"
                  value={gigCategory}
                  onChange={(e) => setGigCategory(e.target.value)}
                  placeholder="General, Delivery..."
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Gig Date</label>
                <input
                  type="date"
                  value={gigDate}
                  onChange={(e) => setGigDate(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Gig Time</label>
                <input
                  type="time"
                  value={gigTime}
                  onChange={(e) => setGigTime(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Description</label>
              <textarea
                required
                rows={3}
                value={gigDescription}
                onChange={(e) => setGigDescription(e.target.value)}
                placeholder="Describe the task, timing, and requirements..."
                className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <button
              type="submit"
              disabled={isSavingGig}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md transition disabled:opacity-50"
            >
              {isSavingGig ? 'Posting...' : editingGig ? 'Save Gig Changes' : 'Post Gig & Go to Map'}
            </button>
          </form>
        </div>
      )}

      {/* Gig Marker Details Modal (with Face Selfie, Views & Interests, Owner Edit/Delete + Apply) */}
      {viewingGig && (() => {
        const ownerAvatar =
          viewingGig.ownerAvatar ||
          seekersList.find((s) => s.uid === viewingGig.ownerId)?.avatar ||
          null;
        const hasValidOwnerAvatar = Boolean(ownerAvatar && ownerAvatar.startsWith('data:image/'));
        const ownerInitials =
          (viewingGig.ownerName || 'U')
            .split(' ')
            .map((p) => p[0] || '')
            .join('')
            .slice(0, 2)
            .toUpperCase() || 'U';
        const isGigOwner = currentUser?.uid === viewingGig.ownerId;

        return (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-3.5 text-xs max-h-[85vh] overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  setViewingGig(null);
                  setConfirmDeleteGigId(null);
                  setGigApplyMessage('');
                }}
                className="absolute top-4 right-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2 pr-6">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                  {viewingGig.pay}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                  {viewingGig.category || 'General'}
                </span>
              </div>

              {/* Gig Owner Face Selfie + Title */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={!hasValidOwnerAvatar}
                  onClick={() => {
                    if (hasValidOwnerAvatar && ownerAvatar) {
                      setLightboxDoc({
                        title: `${viewingGig.ownerName} — Face Selfie`,
                        name: viewingGig.title,
                        url: ownerAvatar,
                        isImage: true,
                      });
                    }
                  }}
                  className={`h-14 w-14 rounded-full overflow-hidden bg-blue-50 border-2 border-blue-200 text-blue-700 flex items-center justify-center shrink-0 text-sm font-black shadow-md ${
                    hasValidOwnerAvatar ? 'cursor-pointer hover:ring-2 hover:ring-blue-400' : 'cursor-default'
                  }`}
                  title={hasValidOwnerAvatar ? 'Tap to enlarge face selfie' : viewingGig.ownerName}
                >
                  {hasValidOwnerAvatar && ownerAvatar ? (
                    <img src={ownerAvatar} alt={viewingGig.ownerName} className="h-full w-full object-cover" />
                  ) : (
                    <span>{ownerInitials}</span>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-slate-900 leading-snug">{viewingGig.title}</h3>
                  <p className="text-[11px] text-slate-500 truncate">Posted by {viewingGig.ownerName}</p>
                </div>
              </div>

              {/* Views & Interests Stats Bar */}
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                    <Eye className="h-3.5 w-3.5 text-blue-600" />
                    <span>{gigViewsCount} {gigViewsCount === 1 ? 'View' : 'Views'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                    <Heart className={`h-3.5 w-3.5 ${gigInterestsCount > 0 ? 'fill-rose-500 text-rose-500' : 'text-rose-500'}`} />
                    <span>{gigInterestsCount} {gigInterestsCount === 1 ? 'Interest' : 'Interests'}</span>
                  </span>
                </div>

                {!isGigOwner && currentUser && (
                  <button
                    type="button"
                    disabled={isTogglingInterest}
                    onClick={() => {
                      playClickSound();
                      handleToggleGigInterest(viewingGig);
                    }}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 transition disabled:opacity-50 ${
                      hasExpressedInterest
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-white border border-slate-300 text-slate-700 hover:border-rose-400 hover:text-rose-600'
                    }`}
                  >
                    <Heart className={`h-3 w-3 ${hasExpressedInterest ? 'fill-white text-white' : ''}`} />
                    <span>{hasExpressedInterest ? 'Interested' : 'Show Interest'}</span>
                  </button>
                )}
              </div>

              {(viewingGig.gigDate || viewingGig.gigTime) && (
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-3 py-2 rounded-xl">
                  <Calendar className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  <span>
                    {viewingGig.gigDate ? viewingGig.gigDate : 'Date flexible'}
                    {viewingGig.gigTime ? ` • ${viewingGig.gigTime}` : ''}
                  </span>
                </div>
              )}

              <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
                {viewingGig.description}
              </p>

              <div className="flex items-start gap-1.5 text-[11px] text-slate-500">
                <MapPin className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span>{viewingGig.locationName}</span>
              </div>

              {isGigOwner ? (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    {confirmDeleteGigId === viewingGig.id ? (
                      <>
                        <button
                          type="button"
                          disabled={isDeletingGig}
                          onClick={() => handleDeleteGig(viewingGig.id)}
                          className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition disabled:opacity-50"
                        >
                          {isDeletingGig ? 'Deleting...' : 'Confirm Delete'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteGigId(null)}
                          className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            playClickSound();
                            handleStartEditGig(viewingGig);
                          }}
                          className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center justify-center gap-1.5 transition"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Edit Gig</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            playClickSound();
                            setConfirmDeleteGigId(viewingGig.id);
                          }}
                          className="flex-1 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold flex items-center justify-center gap-1.5 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete Gig</span>
                        </button>
                      </>
                    )}
                  </div>

                  {/* Owner View of Gig Applicants */}
                  {(() => {
                    const apps = ownerGigApplications.filter((a) => a.gigId === viewingGig.id);
                    if (apps.length === 0) return null;
                    return (
                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        <h4 className="text-[11px] font-bold text-slate-800">Applicants ({apps.length})</h4>
                        {apps.map((app) => (
                          <div key={app.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-900 truncate">{app.applicantName}</span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  app.status === 'accepted'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : app.status === 'rejected'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {app.status.toUpperCase()}
                              </span>
                            </div>
                            {app.message && <p className="text-[11px] text-slate-600">{app.message}</p>}
                            {app.status === 'pending' && (
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateGigApplicationStatus(app.id, 'accepted')}
                                  className="flex-1 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold"
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateGigApplicationStatus(app.id, 'rejected')}
                                  className="flex-1 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-bold"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="pt-2 border-t border-slate-100">
                  {isMainTenant || chosenSubscription === 'tenant' ? (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold text-center">
                      Tenants cannot apply to gig posts.
                    </div>
                  ) : !isSubscriptionActive ? (
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-semibold text-center">
                      Activate your User subscription to apply for gig posts.
                    </div>
                  ) : (() => {
                    const existingApp = myGigApplications.find((a) => a.gigId === viewingGig.id);
                    if (existingApp) {
                      return (
                        <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-semibold text-center">
                          Application Submitted • Status: {existingApp.status.toUpperCase()}
                        </div>
                      );
                    }
                    return (
                      <form onSubmit={handleApplyToGig} className="space-y-2">
                        <input
                          type="text"
                          value={gigApplyMessage}
                          onChange={(e) => setGigApplyMessage(e.target.value)}
                          placeholder="Short note for the gig owner..."
                          className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                        <button
                          type="submit"
                          disabled={isApplyingGig}
                          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>{isApplyingGig ? 'Applying...' : 'Apply to Gig'}</span>
                        </button>
                      </form>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Feature Information Modal */}
      {featureInfoTab && (() => {
        const infoData = FEATURE_INFO_COPY[featureInfoTab];
        const FeatureBadgeIcon =
          featureInfoTab === 'tenant'
            ? Building2
            : featureInfoTab === 'referrals'
            ? Share2
            : featureInfoTab === 'gigs'
            ? Zap
            : featureInfoTab === 'companies'
            ? Store
            : featureInfoTab === 'seekers'
            ? UserSearch
            : featureInfoTab === 'profile'
            ? IdCard
            : Settings;

        return (
          <div className="fixed inset-0 z-80 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4">
            <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] overflow-y-auto">
              <button
                type="button"
                onClick={() => setFeatureInfoTab(null)}
                className="absolute top-4 right-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200">
                  <FeatureBadgeIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {infoData.title}
                  </h3>
                  <p className="text-[11px] text-slate-500">{infoData.subtitle}</p>
                </div>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
                {infoData.description}
              </p>

              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-slate-800">What You Can Do</h4>
                <div className="space-y-2">
                  {infoData.highlights.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-blue-50/50 border border-blue-100 text-xs text-slate-700"
                    >
                      <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setFeatureInfoTab(null)}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition"
              >
                Got It
              </button>
            </div>
          </div>
        );
      })()}

      {/* Settings Help Modal */}
      {settingsHelpOpen && (
        <div className="fixed inset-0 z-80 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[85vh] overflow-y-auto space-y-4">
            <button
              type="button"
              onClick={() => setSettingsHelpOpen(false)}
              className="absolute top-4 right-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">How to Use the App</h3>
                <p className="text-[11px] text-slate-500">Quick guide to every feature</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-slate-700">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-0.5">1. Activate Your Subscription</h4>
                <p>Tap the Upgrade icon, choose Tenant Sub or User Sub, and upload your verification documents using your referrer’s bank transfer details. Your referrer tenant reviews and activates your account.</p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-0.5">2. GiGs Map, Posting & Companies</h4>
                <p>Search any area at the top of the map, tap the Menu icon above Zoom to create a Gig (with Date & Time) or Add a Company Page, and use the bottom-left Business Gadget to locate businesses and book reservations.</p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-0.5">3. Seekers & Road Navigation</h4>
                <p>Publish your own service with a face selfie or hire a seeker in Seekers. Once accepted, follow live road navigation and in-app chat on the GiGs map, then rate the seeker when completed.</p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-0.5">4. Tenant & Referrals</h4>
                <p>Share your referral link to grow your network. Referrals are split into Referral Tenants and User Subs, turn red when close to expiry, and can be extended, frozen, or approved by their direct referrer.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSettingsHelpOpen(false)}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition"
            >
              Close Help
            </button>
          </div>
        </div>
      )}

      {/* Settings About Modal */}
      {settingsAboutOpen && (
        <div className="fixed inset-0 z-80 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4">
          <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <button
              type="button"
              onClick={() => setSettingsAboutOpen(false)}
              className="absolute top-4 right-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">About This App</h3>
                <p className="text-[11px] text-slate-500">Location-Powered GiGs, Companies & Referral Network</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-slate-700 leading-relaxed bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
              <p>
                This platform connects local service seekers, gig posters, businesses, and referral tenants on a live interactive OpenStreetMap workspace.
              </p>
              <p>
                Users can post scheduled gigs, hire rated seekers with turn-by-turn road routing and live chat, explore Company Pages with reservation booking, and earn monthly subscription income through verified referral links.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSettingsAboutOpen(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Settings Send Feedback Modal (All Users -> Main Tenant) */}
      {feedbackModalOpen && (
        <div className="fixed inset-0 z-80 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[85vh] overflow-y-auto space-y-4">
            <button
              type="button"
              onClick={() => setFeedbackModalOpen(false)}
              className="absolute top-4 right-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Send Feedback</h3>
                <p className="text-[11px] text-slate-500">Delivered directly to Main Tenant ({MAIN_TENANT_EMAIL})</p>
              </div>
            </div>

            {feedbackSentSuccess && (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Thank you! Your feedback has been sent to the Main Tenant.</span>
              </div>
            )}

            <form onSubmit={handleSubmitFeedback} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Your Feedback</label>
                <textarea
                  rows={4}
                  required
                  maxLength={1000}
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  placeholder="Share suggestions, report an issue, or tell us what you think..."
                  className="w-full rounded-2xl bg-slate-50 border border-slate-200 p-3 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={isSendingFeedback || !feedbackInput.trim()}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
              >
                {isSendingFeedback ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                <span>{isSendingFeedback ? 'Sending...' : 'Send to Main Tenant'}</span>
              </button>
            </form>

            {myFeedbackList.length > 0 && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <h4 className="text-[11px] font-bold text-slate-700">Your Sent Feedback ({myFeedbackList.length})</h4>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {myFeedbackList.map((fb) => (
                    <div key={fb.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] space-y-2">
                      <div>
                        <p className="text-slate-800">{fb.message}</p>
                        <span className="text-[10px] text-slate-400 block mt-1">
                          {new Date(fb.createdAt).toLocaleString()}
                        </span>
                      </div>

                      {fb.replyMessage && (
                        <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full overflow-hidden bg-blue-600 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                              {fb.repliedByAvatar && fb.repliedByAvatar.startsWith('data:image/') ? (
                                <img src={fb.repliedByAvatar} alt="Main Tenant" className="h-full w-full object-cover" />
                              ) : (
                                <span>MT</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="text-[10px] font-bold text-blue-900 block truncate">
                                Reply from {fb.repliedByName || 'Main Tenant'}
                              </span>
                              {fb.repliedAt && (
                                <span className="text-[9px] text-blue-600 block">
                                  {new Date(fb.repliedAt).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-[11px] text-blue-950 leading-relaxed">{fb.replyMessage}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation Real-Time Chat Modal (between Hiring User and Navigating Seeker) */}
      {hireChatOpen && activeAcceptedHire && (
        <div className="fixed inset-0 z-80 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl border border-slate-200 flex flex-col max-h-[82vh]">
            <button
              type="button"
              onClick={() => setHireChatOpen(false)}
              className="absolute top-4 right-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <X className="h-4 w-4" />
            </button>

            {(() => {
              const otherId =
                currentUser?.uid === activeAcceptedHire.userId
                  ? activeAcceptedHire.seekerId
                  : activeAcceptedHire.userId;
              const otherName =
                currentUser?.uid === activeAcceptedHire.userId
                  ? activeAcceptedHire.seekerName
                  : activeAcceptedHire.userName;
              const otherAvatar = seekersList.find((s) => s.uid === otherId)?.avatar || null;
              const otherInitials =
                (otherName || 'U')
                  .split(' ')
                  .map((p) => p[0] || '')
                  .join('')
                  .slice(0, 2)
                  .toUpperCase() || 'U';
              return (
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100 pr-8">
                  <div className="h-10 w-10 rounded-full overflow-hidden bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center text-xs font-black shrink-0">
                    {otherAvatar && otherAvatar.startsWith('data:image/') ? (
                      <img src={otherAvatar} alt={otherName} className="h-full w-full object-cover" />
                    ) : (
                      <span>{otherInitials}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate">
                      Chat with {otherName}
                    </h3>
                    <p className="text-[11px] text-slate-500 truncate">
                      {activeAcceptedHire.serviceTitle} • To: {activeAcceptedHire.destAddress}
                    </p>
                  </div>
                </div>
              );
            })()}

            <div className="flex-1 overflow-y-auto py-3 space-y-2.5 min-h-[200px] max-h-[48vh] pr-1">
              {hireChatMessages.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                  No messages yet. Say hello or share arrival instructions.
                </div>
              ) : (
                hireChatMessages.map((m) => {
                  const isMine = m.senderId === currentUser?.uid;
                  return (
                    <div key={m.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-xs shadow-sm ${
                          isMine
                            ? 'bg-blue-600 text-white rounded-br-sm'
                            : 'bg-slate-100 text-slate-900 border border-slate-200 rounded-bl-sm'
                        }`}
                      >
                        <p className="leading-relaxed break-words">{m.text}</p>
                      </div>
                      <span className="text-[9px] text-slate-400 mt-0.5 px-1">
                        {isMine ? 'You' : m.senderName} • {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSendHireMessage} className="pt-3 border-t border-slate-100 flex items-center gap-2">
              <input
                type="text"
                maxLength={1000}
                value={hireChatInput}
                onChange={(e) => setHireChatInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="submit"
                disabled={isSendingHireChat || !hireChatInput.trim()}
                className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50 shrink-0"
              >
                {isSendingHireChat ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Main Tenant Feedback Inbox Modal (with Tenant Face Selfie & Sender Information) */}
      {feedbackInboxOpen && isMainTenant && (
        <div className="fixed inset-0 z-80 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[85vh] overflow-y-auto space-y-4">
            <button
              type="button"
              onClick={() => setFeedbackInboxOpen(false)}
              className="absolute top-4 right-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Main Tenant Face Selfie & Information Header */}
            <div className="flex items-center gap-3 pr-8">
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  startCamera();
                }}
                title="Tap to capture or update your Main Tenant face selfie"
                className="relative h-12 w-12 rounded-full overflow-hidden bg-blue-50 text-blue-600 border-2 border-blue-200 flex items-center justify-center shrink-0 hover:ring-2 hover:ring-blue-400 transition"
              >
                {myAvatarThumb && myAvatarThumb.startsWith('data:image/') ? (
                  <img src={myAvatarThumb} alt="Main Tenant Face Selfie" className="h-full w-full object-cover" />
                ) : (
                  <MessageSquare className="h-5 w-5" />
                )}
                <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-blue-600 text-white flex items-center justify-center border border-white">
                  <Camera className="h-2.5 w-2.5" />
                </span>
              </button>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900">
                  User Feedback Inbox ({feedbackList.length})
                </h3>
                <p className="text-[11px] text-slate-500 truncate">
                  Main Tenant: {`${firstName || 'Main'} ${lastName || 'Tenant'}`.trim()} ({MAIN_TENANT_EMAIL})
                </p>
              </div>
            </div>

            {currentUser && !currentUser.emailVerified ? (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-2">
                <span>Verify your email or sign in with Google to view all user feedback.</span>
                <button
                  type="button"
                  onClick={() => sendEmailVerification(currentUser).then(() => setAppNotice('Verification email sent to timegig2026@gmail.com.'))}
                  className="px-3 py-1 rounded-full bg-amber-600 text-white font-bold shrink-0"
                >
                  Verify
                </button>
              </div>
            ) : feedbackList.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                No feedback received from users yet.
              </div>
            ) : (
              <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                {feedbackList.map((fb) => {
                  const seekerMatch = seekersList.find((s) => s.uid === fb.userId);
                  const subMatch = submissions.find((s) => s.userId === fb.userId);
                  const tenantLinkMatch = referralTenants.find((rt) => rt.ownerUid === fb.userId);
                  const resolvedAvatar =
                    fb.userAvatar || seekerMatch?.avatar || subMatch?.selfie || null;
                  const hasValidAvatar = Boolean(resolvedAvatar && resolvedAvatar.startsWith('data:image/'));
                  const initials =
                    (fb.userName || 'U')
                      .split(' ')
                      .map((p) => p[0] || '')
                      .join('')
                      .slice(0, 2)
                      .toUpperCase() || 'U';
                  const resolvedLocation = fb.userLocation || seekerMatch?.location || '';
                  const resolvedStatus = fb.userStatus || subMatch?.status || seekerMatch?.status || '';
                  const resolvedRefCode = fb.userReferralCode || tenantLinkMatch?.code || '';

                  return (
                    <div key={fb.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            type="button"
                            disabled={!hasValidAvatar}
                            onClick={() => {
                              if (hasValidAvatar && resolvedAvatar) {
                                setLightboxDoc({
                                  title: `${fb.userName} — Face Selfie`,
                                  name: fb.userEmail || fb.userTier,
                                  url: resolvedAvatar,
                                  isImage: true,
                                });
                              }
                            }}
                            className={`h-11 w-11 rounded-full overflow-hidden bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center text-xs font-black shrink-0 ${
                              hasValidAvatar ? 'cursor-pointer hover:ring-2 hover:ring-blue-400' : 'cursor-default'
                            }`}
                            title={hasValidAvatar ? 'Tap to enlarge face selfie' : fb.userName}
                          >
                            {hasValidAvatar && resolvedAvatar ? (
                              <img src={resolvedAvatar} alt={fb.userName} className="h-full w-full object-cover" />
                            ) : (
                              <span>{initials}</span>
                            )}
                          </button>

                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 truncate block">{fb.userName}</span>
                            {fb.userEmail && (
                              <span className="text-[10px] text-slate-500 truncate block">{fb.userEmail}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              fb.userTier === 'tenant' || fb.userTier === 'main_tenant'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {fb.userTier === 'main_tenant'
                              ? 'Main Tenant'
                              : fb.userTier === 'tenant'
                              ? 'Tenant Sub'
                              : fb.userTier === 'user'
                              ? 'User Sub'
                              : 'Member'}
                          </span>
                          {resolvedStatus && (
                            <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 text-[9px] font-semibold capitalize">
                              {resolvedStatus}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Sender Info Details (Location, Referral Code, Tenant Signups) */}
                      {(resolvedLocation || resolvedRefCode || tenantLinkMatch) && (
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-600 bg-white/80 px-2.5 py-1.5 rounded-xl border border-slate-200">
                          {resolvedLocation && (
                            <span className="inline-flex items-center gap-1 truncate max-w-full">
                              <MapPin className="h-3 w-3 text-blue-600 shrink-0" />
                              <span className="truncate">{resolvedLocation}</span>
                            </span>
                          )}
                          {resolvedRefCode && (
                            <span className="inline-flex items-center gap-1 font-mono">
                              <Share2 className="h-3 w-3 text-emerald-600 shrink-0" />
                              <span>{resolvedRefCode}</span>
                            </span>
                          )}
                          {tenantLinkMatch && (
                            <span className="inline-flex items-center gap-1 font-semibold text-blue-700">
                              <Users className="h-3 w-3 shrink-0" />
                              <span>
                                Signups: {tenantLinkMatch.currentTenantSignups}T / {tenantLinkMatch.currentUserSignups}U
                              </span>
                            </span>
                          )}
                        </div>
                      )}

                      <p className="text-slate-700 leading-relaxed bg-white p-2.5 rounded-xl border border-slate-200">
                        {fb.message}
                      </p>

                      {fb.replyMessage && (
                        <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-blue-800">
                              Main Tenant Reply ({fb.repliedByName || 'Main Tenant'})
                            </span>
                            {fb.repliedAt && (
                              <span className="text-[9px] text-blue-600">
                                {new Date(fb.repliedAt).toLocaleString()}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-blue-950 leading-relaxed">{fb.replyMessage}</p>
                        </div>
                      )}

                      {replyingFeedbackId === fb.id ? (
                        <div className="space-y-2 pt-1">
                          <textarea
                            rows={2}
                            maxLength={1000}
                            value={replyDraft}
                            onChange={(e) => setReplyDraft(e.target.value)}
                            placeholder={`Write a reply to ${fb.userName}...`}
                            className="w-full rounded-xl bg-white border border-blue-300 p-2 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isSendingReply || !replyDraft.trim()}
                              onClick={() => handleReplyToFeedback(fb)}
                              className="flex-1 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition disabled:opacity-50"
                            >
                              {isSendingReply ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                              <span>{isSendingReply ? 'Sending...' : 'Send Reply'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReplyingFeedbackId(null);
                                setReplyDraft('');
                              }}
                              className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold transition"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-400">
                            {new Date(fb.createdAt).toLocaleString()}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              playClickSound();
                              setReplyingFeedbackId(fb.id);
                              setReplyDraft(fb.replyMessage || '');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold flex items-center gap-1 transition"
                          >
                            <Send className="h-2.5 w-2.5" />
                            <span>{fb.replyMessage ? 'Edit Reply' : 'Reply'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Map Pick Company Location Banner */}
      {isPickingCompanyLocation && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full bg-indigo-600 text-white text-xs font-bold shadow-xl flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5" />
          <span>Tap the exact company location on the map</span>
          <button
            type="button"
            onClick={() => setIsPickingCompanyLocation(false)}
            className="ml-1 rounded-full p-0.5 hover:bg-white/20"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Create / Edit Company Modal */}
      {/* Add / Edit Company Page Modal */}
      {companyFormOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <form onSubmit={handleSaveCompany} className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-3.5 text-xs max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                setCompanyFormOpen(false);
                setEditingCompany(null);
              }}
              className="absolute top-4 right-4 z-10 rounded-full p-1.5 bg-white/80 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>

            <div>
              <h3 className="text-base font-bold text-slate-900 pr-6">
                {editingCompany ? 'Edit Company Page' : 'Create Company Page'}
              </h3>
              <p className="text-[11px] text-slate-500">
                Upload logo & backcover, set map location, hours & reservations
              </p>
            </div>

            {/* Backcover & Logo Uploader Preview */}
            <div className="relative pb-6">
              <div className="relative h-28 w-full rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-blue-600 border border-slate-200 flex items-center justify-center">
                {companyBackcoverUrl ? (
                  <img src={companyBackcoverUrl} alt="Backcover" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[11px] font-bold text-white/80">Upload Backcover Banner</span>
                )}
                <label className="cursor-pointer absolute top-2 left-2 px-2.5 py-1 rounded-xl bg-black/55 hover:bg-black/75 text-white text-[10px] font-bold flex items-center gap-1 backdrop-blur-sm transition">
                  <Upload className="h-3 w-3" />
                  <span>{companyBackcoverUrl ? 'Change Backcover' : 'Upload Backcover'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleCompanyBackcoverUpload} />
                </label>
              </div>

              {/* Overlapping Circular Logo Upload */}
              <div className="absolute bottom-0 left-3 flex items-end gap-2">
                <label className="cursor-pointer group relative h-16 w-16 rounded-2xl overflow-hidden bg-white border-2 border-white shadow-lg flex items-center justify-center">
                  {companyLogoUrl ? (
                    <img src={companyLogoUrl} alt="Company Logo" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-indigo-50 text-indigo-600 flex flex-col items-center justify-center text-[9px] font-bold">
                      <Building2 className="h-5 w-5 mb-0.5" />
                      <span>Logo</span>
                    </div>
                  )}
                  <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[9px] font-bold">
                    Upload
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleCompanyLogoUpload} />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company / Business Name</label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Cafe Horizon"
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <input
                  type="text"
                  maxLength={60}
                  value={companyCategory}
                  onChange={(e) => setCompanyCategory(e.target.value)}
                  placeholder="Restaurant, Salon..."
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>
            </div>

            <div className="relative">
              <label className="block font-semibold text-slate-700 mb-1">Page Map Location</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  value={companyLocationName}
                  onChange={(e) => handleCompanyLocationType(e.target.value)}
                  placeholder="Type street, suburb, city..."
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCompanyFormOpen(false);
                    setActiveTab('gigs');
                    setIsPickingCompanyLocation(true);
                  }}
                  className="px-2.5 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold shrink-0"
                >
                  Pick Map
                </button>
              </div>
              {companyLocationSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 max-h-40 overflow-y-auto rounded-xl bg-white shadow-xl border border-slate-200 z-50">
                  {companyLocationSuggestions.map((s) => (
                    <button
                      key={s.place_id}
                      type="button"
                      onClick={() => {
                        const lat = parseFloat(s.lat);
                        const lng = parseFloat(s.lon);
                        setCompanyLat(lat);
                        setCompanyLng(lng);
                        setCompanyLocationName(s.display_name);
                        setCompanyLocationPicked(true);
                        setCompanyLocationSuggestions([]);
                        if (mapInstanceRef.current) {
                          mapInstanceRef.current.flyTo([lat, lng], 15, { animate: true, duration: 0.8 });
                        }
                      }}
                      className="w-full text-left px-3 py-2 text-[11px] text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-start gap-2"
                    >
                      <MapPin className="h-3.5 w-3.5 text-indigo-600 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{s.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Open Times</label>
              <input
                type="text"
                maxLength={200}
                value={companyOpenTimes}
                onChange={(e) => setCompanyOpenTimes(e.target.value)}
                placeholder="e.g. Mon-Fri 08:00-18:00, Sat 09:00-14:00"
                className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Information</label>
                <input
                  type="text"
                  maxLength={160}
                  value={companyContact}
                  onChange={(e) => setCompanyContact(e.target.value)}
                  placeholder="Phone / WhatsApp"
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Information</label>
                <input
                  type="email"
                  maxLength={200}
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  placeholder="info@company.com"
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Website Link</label>
              <input
                type="text"
                maxLength={300}
                value={companyWebsite}
                onChange={(e) => setCompanyWebsite(e.target.value)}
                placeholder="https://www.yourbusiness.com"
                className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">About Company</label>
              <textarea
                required
                rows={3}
                maxLength={1000}
                value={companyDescription}
                onChange={(e) => setCompanyDescription(e.target.value)}
                placeholder="Describe your company services and what users can book..."
                className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={companyAcceptsReservations}
                onChange={(e) => setCompanyAcceptsReservations(e.target.checked)}
                className="rounded text-indigo-600"
              />
              <span>Allow Users to Book a Reservation</span>
            </label>

            <button
              type="submit"
              disabled={isSavingCompany}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md transition disabled:opacity-50"
            >
              {isSavingCompany ? 'Publishing...' : editingCompany ? 'Save Company Page' : 'Publish Company Page & Go to Map'}
            </button>
          </form>
        </div>
      )}

      {/* Company Page Full Details & Reservation Modal */}
      {viewingCompany && (() => {
        const ownerAvatar =
          viewingCompany.ownerAvatar ||
          seekersList.find((s) => s.uid === viewingCompany.ownerId)?.avatar ||
          null;
        const logoSrc = viewingCompany.logoUrl || ownerAvatar;
        const hasValidLogo = Boolean(logoSrc && logoSrc.startsWith('data:image/'));
        const isCompanyOwner = currentUser?.uid === viewingCompany.ownerId;
        const safeWebsiteHref = viewingCompany.website
          ? /^https?:\/\//i.test(viewingCompany.website.trim())
            ? viewingCompany.website.trim()
            : `https://${viewingCompany.website.trim()}`
          : '';
        const myResForCompany = myCompanyReservations.filter((r) => r.companyId === viewingCompany.id);
        const ownerResForCompany = ownerCompanyReservations.filter((r) => r.companyId === viewingCompany.id);

        return (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden text-xs max-h-[88vh] overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  setViewingCompany(null);
                  setConfirmDeleteCompanyId(null);
                  setResFormOpen(false);
                }}
                className="absolute top-3 right-3 z-20 rounded-full p-1.5 bg-black/55 text-white hover:bg-black/75 transition"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Company Backcover Banner */}
              <div className="relative h-32 w-full bg-gradient-to-br from-indigo-600 via-violet-600 to-blue-600">
                {viewingCompany.backcoverUrl && (
                  <img
                    src={viewingCompany.backcoverUrl}
                    alt={`${viewingCompany.name} backcover`}
                    className="h-full w-full object-cover cursor-pointer"
                    onClick={() =>
                      setLightboxDoc({
                        title: `${viewingCompany.name} — Backcover`,
                        name: viewingCompany.category || 'Company Page',
                        url: viewingCompany.backcoverUrl!,
                        isImage: true,
                      })
                    }
                  />
                )}
                <div className="absolute bottom-2 right-3 flex items-center gap-1.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold">
                    {viewingCompany.category || 'Services'}
                  </span>
                </div>
              </div>

              <div className="px-5 pb-5 space-y-3.5">
                {/* Overlapping Logo + Company Name */}
                <div className="flex items-end gap-3 -mt-8 relative z-10">
                  <button
                    type="button"
                    disabled={!hasValidLogo}
                    onClick={() => {
                      if (hasValidLogo && logoSrc) {
                        setLightboxDoc({
                          title: `${viewingCompany.name} — Logo`,
                          name: viewingCompany.ownerName,
                          url: logoSrc,
                          isImage: true,
                        });
                      }
                    }}
                    className={`h-16 w-16 rounded-2xl overflow-hidden bg-white border-4 border-white text-indigo-700 flex items-center justify-center shrink-0 shadow-lg ${
                      hasValidLogo ? 'cursor-pointer hover:ring-2 hover:ring-indigo-400' : 'cursor-default'
                    }`}
                  >
                    {hasValidLogo && logoSrc ? (
                      <img src={logoSrc} alt={viewingCompany.name} className="h-full w-full object-cover" />
                    ) : (
                      <Building2 className="h-7 w-7" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1 pt-8">
                    <h3 className="text-base font-extrabold text-slate-900 leading-snug truncate">
                      {viewingCompany.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 truncate">Managed by {viewingCompany.ownerName}</p>
                  </div>
                </div>

                {/* About Description */}
                <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {viewingCompany.description}
                </p>

                {/* Hours, Contact, Email, Website, Location */}
                <div className="space-y-2">
                  {viewingCompany.openTimes && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-700 bg-amber-50/70 px-3 py-2 rounded-xl border border-amber-200/70">
                      <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span className="font-semibold">Open: {viewingCompany.openTimes}</span>
                    </div>
                  )}

                  {viewingCompany.contact && (
                    <div className="flex items-center gap-2 text-[11px] text-indigo-800 bg-indigo-50 px-3 py-2 rounded-xl border border-indigo-100">
                      <Phone className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                      <span className="font-semibold truncate">{viewingCompany.contact}</span>
                    </div>
                  )}

                  {viewingCompany.email && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-700 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                      <Mail className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <a href={`mailto:${viewingCompany.email}`} className="font-semibold text-blue-700 hover:underline truncate">
                        {viewingCompany.email}
                      </a>
                    </div>
                  )}

                  {safeWebsiteHref && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-700 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                      <Globe className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <a
                        href={safeWebsiteHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-emerald-700 hover:underline truncate"
                      >
                        {viewingCompany.website}
                      </a>
                    </div>
                  )}

                  <div className="flex items-start gap-1.5 text-[11px] text-slate-500 px-1">
                    <MapPin className="h-3.5 w-3.5 text-indigo-600 shrink-0 mt-0.5" />
                    <span>{viewingCompany.locationName}</span>
                  </div>
                </div>

                {/* Navigate to Company with Lady Voice Guidance */}
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    handleStartNavigateToCompany(viewingCompany);
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md flex items-center justify-center gap-2 transition"
                >
                  <Navigation className="h-4 w-4" />
                  <span>Navigate to Company</span>
                  <Volume2 className="h-3.5 w-3.5 opacity-90" />
                </button>

                {/* Visitor Reservation Booking */}
                {!isCompanyOwner && viewingCompany.acceptsReservations !== false && (
                  <div className="pt-2 border-t border-slate-100 space-y-2.5">
                    {!resFormOpen ? (
                      <button
                        type="button"
                        onClick={() => {
                          playClickSound();
                          if (!currentUser) {
                            setAuthModalOpen(true);
                            return;
                          }
                          setResDate(new Date().toISOString().slice(0, 10));
                          setResTime('10:00');
                          setResFormOpen(true);
                        }}
                        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md flex items-center justify-center gap-1.5 transition"
                      >
                        <Calendar className="h-4 w-4" />
                        <span>Book a Reservation</span>
                      </button>
                    ) : (
                      <form onSubmit={handleSubmitReservation} className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-indigo-950 flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                            <span>Book a Reservation</span>
                          </h4>
                          <button
                            type="button"
                            onClick={() => setResFormOpen(false)}
                            className="text-[11px] text-slate-500 hover:text-slate-800 font-bold"
                          >
                            Cancel
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Date</label>
                            <input
                              type="date"
                              required
                              value={resDate}
                              onChange={(e) => setResDate(e.target.value)}
                              className="w-full rounded-xl bg-white border border-slate-200 p-2 text-slate-900"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Time</label>
                            <input
                              type="time"
                              required
                              value={resTime}
                              onChange={(e) => setResTime(e.target.value)}
                              className="w-full rounded-xl bg-white border border-slate-200 p-2 text-slate-900"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            maxLength={40}
                            value={resGuests}
                            onChange={(e) => setResGuests(e.target.value)}
                            placeholder="Guests / People (e.g. 2)"
                            className="rounded-xl bg-white border border-slate-200 p-2 text-slate-900"
                          />
                          <input
                            type="text"
                            maxLength={80}
                            value={resPhone}
                            onChange={(e) => setResPhone(e.target.value)}
                            placeholder="Your contact phone"
                            className="rounded-xl bg-white border border-slate-200 p-2 text-slate-900"
                          />
                        </div>
                        <input
                          type="text"
                          maxLength={400}
                          value={resNotes}
                          onChange={(e) => setResNotes(e.target.value)}
                          placeholder="Notes or special request (optional)"
                          className="w-full rounded-xl bg-white border border-slate-200 p-2 text-slate-900"
                        />
                        <button
                          type="submit"
                          disabled={isSubmittingRes}
                          className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition disabled:opacity-50"
                        >
                          {isSubmittingRes ? 'Booking...' : 'Confirm Reservation'}
                        </button>
                      </form>
                    )}

                    {myResForCompany.length > 0 && (
                      <div className="space-y-1.5">
                        <h4 className="text-[11px] font-bold text-slate-700">Your Reservations</h4>
                        {myResForCompany.map((r) => (
                          <div key={r.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900">
                                {r.reservationDate} at {r.reservationTime} ({r.guests || '1'} guest{r.guests === '1' ? '' : 's'})
                              </p>
                              <span
                                className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  r.status === 'confirmed'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : r.status === 'declined' || r.status === 'cancelled'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {r.status.toUpperCase()}
                              </span>
                            </div>
                            {(r.status === 'pending' || r.status === 'confirmed') && (
                              <button
                                type="button"
                                onClick={() => handleUpdateReservationStatus(r.id, 'cancelled')}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[10px] font-bold shrink-0"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Owner Actions & Incoming Reservations */}
                {isCompanyOwner && (
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      {confirmDeleteCompanyId === viewingCompany.id ? (
                        <>
                          <button
                            type="button"
                            disabled={isDeletingCompany}
                            onClick={() => handleDeleteCompany(viewingCompany.id)}
                            className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition disabled:opacity-50"
                          >
                            {isDeletingCompany ? 'Deleting...' : 'Confirm Delete'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteCompanyId(null)}
                            className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              playClickSound();
                              handleStartEditCompany(viewingCompany);
                            }}
                            className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-1.5 transition"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Edit Page</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              playClickSound();
                              setConfirmDeleteCompanyId(viewingCompany.id);
                            }}
                            className="flex-1 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold flex items-center justify-center gap-1.5 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Delete Page</span>
                          </button>
                        </>
                      )}
                    </div>

                    {ownerResForCompany.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <h4 className="text-[11px] font-bold text-slate-800">
                          Reservations ({ownerResForCompany.length})
                        </h4>
                        {ownerResForCompany.map((r) => (
                          <div key={r.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-900 truncate">{r.userName}</span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  r.status === 'confirmed'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : r.status === 'declined' || r.status === 'cancelled'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {r.status.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-700 font-semibold">
                              {r.reservationDate} at {r.reservationTime} • {r.guests || '1'} guest{r.guests === '1' ? '' : 's'}
                            </p>
                            {r.contactPhone && <p className="text-[10px] text-slate-500">Phone: {r.contactPhone}</p>}
                            {r.notes && <p className="text-[10px] text-slate-600">{r.notes}</p>}
                            {r.status === 'pending' && (
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateReservationStatus(r.id, 'confirmed')}
                                  className="flex-1 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateReservationStatus(r.id, 'declined')}
                                  className="flex-1 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-bold"
                                >
                                  Decline
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
