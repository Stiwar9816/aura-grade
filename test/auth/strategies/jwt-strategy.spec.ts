import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtStrategy } from 'src/auth/strategies/jwt-strategy';
import { User } from 'src/user/entities/user.entity';
import { JwtPayload } from 'src/auth/interface/jwt-payload.interface';
import { DocumentType, UserRoles } from 'src/auth/enums';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let userRepository: Repository<User>;

  const mockUser: User = {
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

  const mockUserRepository = {
    findOneBy: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-secret-key'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return user when token is valid and user is active', async () => {
      const payload: JwtPayload = {
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        last_name: mockUser.last_name,
        role: UserRoles.Administrador,
      };

      mockUserRepository.findOneBy.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(mockUserRepository.findOneBy).toHaveBeenCalledWith({ id: payload.id });
      expect(result).toBeDefined();
      expect(result.id).toBe(mockUser.id);
      expect(result.role).toBe(payload.role);
      expect(result.password).toBeUndefined();
    });

    it('should throw UnauthorizedException when user not found', async () => {
      const payload: JwtPayload = {
        id: 'non-existent-id',
        email: 'test@example.com',
        name: 'Test',
        last_name: 'User',
        role: UserRoles.Estudiante,
      };

      mockUserRepository.findOneBy.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(payload)).rejects.toThrow('Token not valid');
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      const payload: JwtPayload = {
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        last_name: mockUser.last_name,
        role: UserRoles.Estudiante,
      };

      const inactiveUser = { ...mockUser, isActive: false };
      mockUserRepository.findOneBy.mockResolvedValue(inactiveUser);

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(payload)).rejects.toThrow(
        'User is inactive, talk with an admin'
      );
    });

    it('should update user role from payload', async () => {
      const payload: JwtPayload = {
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        last_name: mockUser.last_name,
        role: UserRoles.Docente,
      };

      const userWithDifferentRole = { ...mockUser, role: UserRoles.Estudiante };
      mockUserRepository.findOneBy.mockResolvedValue(userWithDifferentRole);

      const result = await strategy.validate(payload);

      expect(result.role).toBe(UserRoles.Docente);
    });

    it('should remove password from returned user', async () => {
      const payload: JwtPayload = {
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        last_name: mockUser.last_name,
        role: UserRoles.Estudiante,
      };

      mockUserRepository.findOneBy.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(result.password).toBeUndefined();
    });
  });
});
