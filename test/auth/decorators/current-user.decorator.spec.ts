import { ExecutionContext, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { resolveCurrentUser } from 'src/auth/decorators/current-user.decorator';
import { User } from 'src/user/entities/user.entity';
import { DocumentType, UserRoles } from 'src/auth/enums';
import { InstitutionApprovalStatus } from 'src/institution';

describe('CurrentUser Decorator', () => {
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
    approvalStatus: InstitutionApprovalStatus.APPROVED,
    institutionId: 'f1d24f6e-b766-4e3f-a1c9-4d4c0a58ad31',
    institution: {
      id: 'f1d24f6e-b766-4e3f-a1c9-4d4c0a58ad31',
      name: 'Universidad Aura',
      slug: 'universidad-aura',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    authVersion: 1,
    checkFieldsBeforeInsert: jest.fn(),
    checkFieldsBeforeUpdate: jest.fn(),
  };

  describe('HTTP Context', () => {
    it('should extract user from HTTP request', () => {
      const mockExecutionContext = {
        getType: jest.fn().mockReturnValue('http'),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ user: mockUser }),
        }),
      } as unknown as ExecutionContext;

      const result = resolveCurrentUser(undefined, mockExecutionContext);

      expect(result).toEqual(mockUser);
    });

    it('should return user when role matches', () => {
      const mockExecutionContext = {
        getType: jest.fn().mockReturnValue('http'),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ user: mockUser }),
        }),
      } as unknown as ExecutionContext;

      const result = resolveCurrentUser([UserRoles.Administrador], mockExecutionContext);

      expect(result).toEqual(mockUser);
    });

    it('should throw ForbiddenException when role does not match', () => {
      const mockExecutionContext = {
        getType: jest.fn().mockReturnValue('http'),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ user: mockUser }),
        }),
      } as unknown as ExecutionContext;

      expect(() => resolveCurrentUser([UserRoles.Estudiante], mockExecutionContext)).toThrow(
        ForbiddenException
      );
      expect(() => resolveCurrentUser([UserRoles.Estudiante], mockExecutionContext)).toThrow(
        `User ${mockUser.name} ${mockUser.last_name} You do not have permission`
      );
    });

    it('should throw InternalServerErrorException when user is not in request', () => {
      const mockExecutionContext = {
        getType: jest.fn().mockReturnValue('http'),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({}),
        }),
      } as unknown as ExecutionContext;

      expect(() => resolveCurrentUser(undefined, mockExecutionContext)).toThrow(
        InternalServerErrorException
      );
      expect(() => resolveCurrentUser(undefined, mockExecutionContext)).toThrow(
        'There is no user inside the request - make sure you have used AuthGuard'
      );
    });
  });

  describe('GraphQL Context', () => {
    it('should extract user from GraphQL request', () => {
      const mockGqlContext = {
        getContext: jest.fn().mockReturnValue({ req: { user: mockUser } }),
      };

      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue(mockGqlContext as any);

      const mockExecutionContext = {
        getType: jest.fn().mockReturnValue('graphql'),
      } as unknown as ExecutionContext;

      const result = resolveCurrentUser(undefined, mockExecutionContext);

      expect(result).toEqual(mockUser);
    });

    it('should return user when role matches in GraphQL context', () => {
      const mockGqlContext = {
        getContext: jest.fn().mockReturnValue({ req: { user: mockUser } }),
      };

      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue(mockGqlContext as any);

      const mockExecutionContext = {
        getType: jest.fn().mockReturnValue('graphql'),
      } as unknown as ExecutionContext;

      const result = resolveCurrentUser([UserRoles.Administrador], mockExecutionContext);

      expect(result).toEqual(mockUser);
    });

    it('should throw ForbiddenException when role does not match in GraphQL', () => {
      const mockGqlContext = {
        getContext: jest.fn().mockReturnValue({ req: { user: mockUser } }),
      };

      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue(mockGqlContext as any);

      const mockExecutionContext = {
        getType: jest.fn().mockReturnValue('graphql'),
      } as unknown as ExecutionContext;

      expect(() => resolveCurrentUser([UserRoles.Docente], mockExecutionContext)).toThrow(
        ForbiddenException
      );
    });
  });

  describe('Role Validation', () => {
    it('should return user without role validation when role is undefined', () => {
      const mockExecutionContext = {
        getType: jest.fn().mockReturnValue('http'),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ user: mockUser }),
        }),
      } as unknown as ExecutionContext;

      const result = resolveCurrentUser(undefined, mockExecutionContext);

      expect(result).toEqual(mockUser);
    });

    it('should validate multiple roles correctly', () => {
      const roles = [UserRoles.Administrador, UserRoles.Docente, UserRoles.Estudiante];

      roles.forEach((role) => {
        const userWithRole = { ...mockUser, role };
        const mockExecutionContext = {
          getType: jest.fn().mockReturnValue('http'),
          switchToHttp: jest.fn().mockReturnValue({
            getRequest: jest.fn().mockReturnValue({ user: userWithRole }),
          }),
        } as unknown as ExecutionContext;

        const result = resolveCurrentUser([role], mockExecutionContext);
        expect(result.role).toBe(role);
      });
    });
  });
});
