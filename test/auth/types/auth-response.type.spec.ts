import { AuthResponde } from 'src/auth/types/auth-response.type';
import { User } from 'src/user/entities/user.entity';
import { DocumentType, UserRoles } from 'src/auth/enums';

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
      checkFieldsBeforeInsert: jest.fn(),
      checkFieldsBeforeUpdate: jest.fn(),
    };

    authResponse = new AuthResponde();
    authResponse.token = 'mock-jwt-token-123';
    authResponse.user = mockUser;
  });

  it('should be defined', () => {
    expect(authResponse).toBeDefined();
  });

  describe('Properties', () => {
    it('should have token property', () => {
      expect(authResponse.token).toBeDefined();
      expect(typeof authResponse.token).toBe('string');
    });

    it('should have user property', () => {
      expect(authResponse.user).toBeDefined();
      expect(authResponse.user).toBeInstanceOf(Object);
    });

    it('should contain valid JWT token', () => {
      expect(authResponse.token).toBe('mock-jwt-token-123');
      expect(authResponse.token.length).toBeGreaterThan(0);
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
      expect(authResponse).toHaveProperty('token');
      expect(authResponse).toHaveProperty('user');
    });

    it('should be usable for login response', () => {
      const loginResponse = {
        token: 'login-token',
        user: mockUser,
      };

      expect(loginResponse).toHaveProperty('token');
      expect(loginResponse).toHaveProperty('user');
      expect(loginResponse.user).toBe(mockUser);
    });

    it('should be usable for signup response', () => {
      const signupResponse = {
        token: 'signup-token',
        user: mockUser,
      };

      expect(signupResponse).toHaveProperty('token');
      expect(signupResponse).toHaveProperty('user');
      expect(signupResponse.user).toBe(mockUser);
    });
  });
});
