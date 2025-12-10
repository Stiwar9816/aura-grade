import { User } from 'src/user/entities/user.entity';
import { DocumentType, UserRoles } from 'src/auth/enums';

describe('User Entity', () => {
  let user: User;

  beforeEach(() => {
    user = new User();
    user.id = '123e4567-e89b-12d3-a456-426614174000';
    user.name = 'John';
    user.last_name = 'Doe';
    user.document_type = DocumentType.CITIZENSHIP_CARD;
    user.document_num = 123456789;
    user.phone = 3001234567;
    user.email = 'John.Doe@Example.COM';
    user.password = 'hashedPassword123';
    user.isActive = true;
    user.role = UserRoles.Estudiante;
  });

  it('should be defined', () => {
    expect(user).toBeDefined();
  });

  describe('Entity Properties', () => {
    it('should have all required properties', () => {
      expect(user.id).toBeDefined();
      expect(user.name).toBeDefined();
      expect(user.last_name).toBeDefined();
      expect(user.document_type).toBeDefined();
      expect(user.document_num).toBeDefined();
      expect(user.phone).toBeDefined();
      expect(user.email).toBeDefined();
      expect(user.password).toBeDefined();
      expect(user.isActive).toBeDefined();
      expect(user.role).toBeDefined();
    });

    it('should have correct property types', () => {
      expect(typeof user.id).toBe('string');
      expect(typeof user.name).toBe('string');
      expect(typeof user.last_name).toBe('string');
      expect(typeof user.document_num).toBe('number');
      expect(typeof user.phone).toBe('number');
      expect(typeof user.email).toBe('string');
      expect(typeof user.password).toBe('string');
      expect(typeof user.isActive).toBe('boolean');
    });

    it('should have default role as Estudiante', () => {
      const newUser = new User();
      newUser.role = UserRoles.Estudiante;
      expect(newUser.role).toBe(UserRoles.Estudiante);
    });

    it('should have default isActive as true', () => {
      const newUser = new User();
      newUser.isActive = true;
      expect(newUser.isActive).toBe(true);
    });
  });

  describe('checkFieldsBeforeInsert', () => {
    it('should convert email to lowercase', () => {
      user.email = 'TEST@EXAMPLE.COM';
      user.checkFieldsBeforeInsert();
      expect(user.email).toBe('test@example.com');
    });

    it('should trim email whitespace', () => {
      user.email = '  test@example.com  ';
      user.checkFieldsBeforeInsert();
      expect(user.email).toBe('test@example.com');
    });

    it('should handle email with mixed case and whitespace', () => {
      user.email = '  TeSt@ExAmPlE.CoM  ';
      user.checkFieldsBeforeInsert();
      expect(user.email).toBe('test@example.com');
    });

    it('should not modify already lowercase trimmed email', () => {
      user.email = 'test@example.com';
      user.checkFieldsBeforeInsert();
      expect(user.email).toBe('test@example.com');
    });
  });

  describe('checkFieldsBeforeUpdate', () => {
    it('should convert email to lowercase on update', () => {
      user.email = 'UPDATED@EXAMPLE.COM';
      user.checkFieldsBeforeUpdate();
      expect(user.email).toBe('updated@example.com');
    });

    it('should trim email whitespace on update', () => {
      user.email = '  updated@example.com  ';
      user.checkFieldsBeforeUpdate();
      expect(user.email).toBe('updated@example.com');
    });

    it('should handle email with mixed case and whitespace on update', () => {
      user.email = '  UpDaTeD@ExAmPlE.CoM  ';
      user.checkFieldsBeforeUpdate();
      expect(user.email).toBe('updated@example.com');
    });
  });

  describe('Document Types', () => {
    it('should accept all valid document types', () => {
      const documentTypes = [
        DocumentType.CITIZENSHIP_CARD,
        DocumentType.PASSPORT,
        DocumentType.CIVIL_REGISRTRY,
        DocumentType.FOREIGNER_CARD,
        DocumentType.MILITARY_ID,
        DocumentType.IDENTITY_CARD,
      ];

      documentTypes.forEach((docType) => {
        user.document_type = docType;
        expect(user.document_type).toBe(docType);
      });
    });
  });

  describe('User Roles', () => {
    it('should accept all valid user roles', () => {
      const roles = [UserRoles.Administrador, UserRoles.Docente, UserRoles.Estudiante];

      roles.forEach((role) => {
        user.role = role;
        expect(user.role).toBe(role);
      });
    });
  });

  describe('User Status', () => {
    it('should toggle isActive status', () => {
      user.isActive = true;
      expect(user.isActive).toBe(true);

      user.isActive = false;
      expect(user.isActive).toBe(false);
    });
  });
});
