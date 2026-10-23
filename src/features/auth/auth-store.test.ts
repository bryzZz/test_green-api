import { createAuthStore } from './auth-store';

const credentials = {
  apiUrl: 'https://api.green-api.com',
  idInstance: '1101000001',
  apiTokenInstance: 'secret-token',
};

describe('auth store', () => {
  it('starts logged out', () => {
    expect(createAuthStore().getState().credentials).toBeNull();
  });

  it('keeps the credentials after login, also across a reload', () => {
    createAuthStore().getState().login(credentials);

    const reloaded = createAuthStore();

    expect(reloaded.getState().credentials).toEqual(credentials);
  });

  it('forgets the credentials on logout, also across a reload', () => {
    const store = createAuthStore();
    store.getState().login(credentials);

    store.getState().logout();

    expect(store.getState().credentials).toBeNull();
    expect(createAuthStore().getState().credentials).toBeNull();
  });
});
