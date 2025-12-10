import { Test, TestingModule } from '@nestjs/testing';
import { UserResolver } from 'src/user/user.resolver';
import { UserService } from 'src/user/user.service';
import { User } from 'src/user/entities/user.entity';
import { UpdateUserInput } from 'src/user/dto';
import { DocumentType } from 'src/auth/enums/user-document-type.enum';
import { UserRoles } from 'src/auth/enums';

describe('UserResolver', () => {
  let resolver: UserResolver;
  let userService: UserService;

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
    role: UserRoles.Administrador,
    checkFieldsBeforeInsert: jest.fn(),
    checkFieldsBeforeUpdate: jest.fn(),
  };

  const mockUserService = {
    findAll: jest.fn(),
    findOneById: jest.fn(),
    findOneByEmail: jest.fn(),
    update: jest.fn(),
    block: jest.fn(),
    resetPassword: jest.fn(),
    resetPasswordAuth: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserResolver,
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    resolver = module.get<UserResolver>(UserResolver);
    userService = module.get<UserService>(UserService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      const users = [mockUser];
      mockUserService.findAll.mockResolvedValue(users);

      const result = await resolver.findAll(mockUser);

      expect(mockUserService.findAll).toHaveBeenCalled();
      expect(result).toEqual(users);
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      mockUserService.findOneById.mockResolvedValue(mockUser);

      const result = await resolver.findOne(userId, mockUser);

      expect(mockUserService.findOneById).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockUser);
    });

    it('should handle UUID validation', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      mockUserService.findOneById.mockResolvedValue(mockUser);

      const result = await resolver.findOne(userId, mockUser);

      expect(result).toEqual(mockUser);
    });
  });

  describe('findOneByEmail', () => {
    it('should return a user by email', async () => {
      const email = 'john.doe@example.com';
      mockUserService.findOneByEmail.mockResolvedValue(mockUser);

      const result = await resolver.findOneByEmail(email, mockUser);

      expect(mockUserService.findOneByEmail).toHaveBeenCalledWith(email);
      expect(result).toEqual(mockUser);
    });
  });

  describe('updateUser', () => {
    it('should update a user', async () => {
      const updateUserInput: UpdateUserInput = {
        id: mockUser.id,
        name: 'Jane',
        last_name: 'Doe',
        document_type: DocumentType.CITIZENSHIP_CARD,
        document_num: 123456789,
        phone: 3001234567,
        email: 'jane.doe@example.com',
        role: UserRoles.Estudiante,
        isActive: true,
      };

      const updatedUser = { ...mockUser, name: 'Jane' };
      mockUserService.update.mockResolvedValue(updatedUser);

      const result = await resolver.updateUser(updateUserInput, mockUser);

      expect(mockUserService.update).toHaveBeenCalledWith(updateUserInput.id, updateUserInput);
      expect(result).toEqual(updatedUser);
    });
  });

  describe('blockUser', () => {
    it('should block a user', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const blockedUser = { ...mockUser, isActive: false };
      mockUserService.block.mockResolvedValue(blockedUser);

      const result = await resolver.blockUser(userId, mockUser);

      expect(mockUserService.block).toHaveBeenCalledWith(userId);
      expect(result).toEqual(blockedUser);
      expect(result.isActive).toBe(false);
    });
  });

  describe('resetPassword', () => {
    it('should reset password for a user', async () => {
      const email = 'john.doe@example.com';
      mockUserService.resetPassword.mockResolvedValue(mockUser);

      const result = await resolver.resetPassword(email);

      expect(mockUserService.resetPassword).toHaveBeenCalledWith(email);
      expect(result).toEqual(mockUser);
    });
  });

  describe('resetPasswordAuth', () => {
    it('should reset password for authenticated user', async () => {
      const newPassword = 'NewPassword123';
      mockUserService.resetPasswordAuth.mockResolvedValue(mockUser);

      const result = await resolver.resetPasswordAuth(newPassword, mockUser);

      expect(mockUserService.resetPasswordAuth).toHaveBeenCalledWith(newPassword, mockUser);
      expect(result).toEqual(mockUser);
    });
  });
});
