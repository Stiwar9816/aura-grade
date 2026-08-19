import { AuthResponde } from 'src/auth/types/auth-response.type';
import { User } from 'src/user/entities/user.entity';
import { DocumentType, UserRoles } from 'src/auth/enums';
import { InstitutionApprovalStatus } from 'src/institution';

describe('AuthResponde Type', () => {
  let authResponse: AuthResponde;
  let mockUser: User;

  beforeEach(() => {
    mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'John',
      last_name: 'Doe',
      document_type: DocumentType.CITIZENSHIP_CARD,
      document_num: 123456789,
      phone: 3001234567,
      email: 'john.doe@example.com',
      password: 'hashedPassword123',
      isActive: true,
      role: UserRoles.Estudiante,
      approvalStatus: InstitutionApprovalStatus.APPROVED,
      institutionId: 'f1d24f6e-b766-4e3f-a1c9-4d4c0a58ad31',
      institution: {
        id: 'f1d24f6e-b766-4e3f-a1c9-4d4c0a58ad31',
        name: 'Universidad Aura',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      authVersion: 1,
      isPlatformAdmin: false,
      checkFieldsBeforeInsert: jest.fn(),
      checkFieldsBeforeUpdate: jest.fn(),
    };

    authResponse = new AuthResponde();
    authResponse.sessionToken = 'opaque-session-token-123';
    authResponse.user = mockUser;
  });

  it('should be defined', () => {
    expect(authResponse).toBeDefined();
  });

  describe('Properties', () => {
    it('should have sessionToken property', () => {
      expect(authResponse.sessionToken).toBeDefined();
      expect(typeof authResponse.sessionToken).toBe('string');
    });

    it('should have user property', () => {
      expect(authResponse.user).toBeDefined();
      expect(authResponse.user).toBeInstanceOf(Object);
    });

    it('should contain an opaque session token', () => {
      expect(authResponse.sessionToken).toBe('opaque-session-token-123');
      expect(authResponse.sessionToken.length).toBeGreaterThan(0);
    });

    it('should contain user object with all properties', () => {
      expect(authResponse.user.id).toBe(mockUser.id);
      expect(authResponse.user.name).toBe(mockUser.name);
      expect(authResponse.user.last_name).toBe(mockUser.last_name);
      expect(authResponse.user.email).toBe(mockUser.email);
      expect(authResponse.user.role).toBe(mockUser.role);
    });
  });

  describe('Response Structure', () => {
    it('should match expected auth response structure', () => {
      expect(authResponse).toHaveProperty('sessionToken');
      expect(authResponse).toHaveProperty('user');
    });

    it('should be usable for login response', () => {
      const loginResponse = {
        sessionToken: 'login-session-token',
        user: mockUser,
      };

      expect(loginResponse).toHaveProperty('sessionToken');
      expect(loginResponse).toHaveProperty('user');
      expect(loginResponse.user).toBe(mockUser);
    });

    it('should be usable for signup response', () => {
      const signupResponse = {
        sessionToken: 'signup-session-token',
        user: mockUser,
      };

      expect(signupResponse).toHaveProperty('sessionToken');
      expect(signupResponse).toHaveProperty('user');
      expect(signupResponse.user).toBe(mockUser);
    });
  });
});
