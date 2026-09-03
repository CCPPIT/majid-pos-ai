/**
 * Jest setup — registered BEFORE source modules load.
 */
jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// useColorScheme's native Appearance module is absent under Node and would be
// lazy-required after the jest environment tears down. Mock the hook module
// directly to a stable 'dark' scheme for every render.
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'dark',
}));

// expo-localization device locales — stable Arabic device for tests.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'ar', regionCode: 'YE' }],
}));

// expo-updates reload is a no-op under jest.
jest.mock('expo-updates', () => ({
  isEnabled: false,
  reloadAsync: jest.fn(),
}));

// Native modules absent under Node — provide simple mocks.
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK: 'AfterFirstUnlock',
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async (_alg: string, data: string) => `hash:${data}`),
  randomUUID: () => 'test-uuid-0000',
}));

jest.mock('expo-local-authentication', () => ({
  AuthenticationType: { FACIAL_RECOGNITION: 1, FINGERPRINT: 2, IRIS: 3 },
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  supportedAuthenticationTypesAsync: jest.fn(async () => [2]),
  authenticateAsync: jest.fn(async () => ({ success: true })),
}));
