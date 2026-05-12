// Mock localStorage for Node environment
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
  writable: true,
});

process.env.RESEND_CONFIRMATION_TEMPLATE_ID ??= 'tmpl_confirmation_test';
process.env.RESEND_UPDATE_PASSWORD_TEMPLATE_ID ??= 'tmpl_update_password_test';
process.env.RESEND_RESET_PASSWORD_TEMPLATE_ID ??= 'tmpl_reset_password_test';
