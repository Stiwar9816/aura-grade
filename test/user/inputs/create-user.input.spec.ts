import { validate } from 'class-validator';
import { CreateUserInput } from 'src/user/dto/inputs/create-user.input';
import { DocumentType } from 'src/auth/enums/user-document-type.enum';
import { UserRoles } from 'src/auth/enums';

describe('CreateUserInput', () => {
  let createUserInput: CreateUserInput;

  beforeEach(() => {
    createUserInput = new CreateUserInput();
    createUserInput.name = 'John';
    createUserInput.last_name = 'Doe';
    createUserInput.document_type = DocumentType.CITIZENSHIP_CARD;
    createUserInput.document_num = 123456789;
    createUserInput.phone = 3001234567;
    createUserInput.email = 'john.doe@example.com';
    createUserInput.password = 'Password123';
    createUserInput.role = UserRoles.Estudiante;
  });

  it('should pass validation with valid data', async () => {
    const errors = await validate(createUserInput);
    expect(errors.length).toBe(0);
  });

  describe('name validation', () => {
    it('should fail if name is empty', async () => {
      createUserInput.name = '';
      const errors = await validate(createUserInput);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('name');
    });

    it('should fail if name is not a string', async () => {
      createUserInput.name = 123 as any;
      const errors = await validate(createUserInput);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('last_name validation', () => {
    it('should fail if last_name is empty', async () => {
      createUserInput.last_name = '';
      const errors = await validate(createUserInput);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('last_name');
    });
  });

  describe('document_type validation', () => {
    it('should fail if document_type is invalid', async () => {
      createUserInput.document_type = 'InvalidType' as any;
      const errors = await validate(createUserInput);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'document_type')).toBe(true);
    });

    it('should pass with valid document types', async () => {
      const validTypes = [
        DocumentType.CITIZENSHIP_CARD,
        DocumentType.PASSPORT,
        DocumentType.CIVIL_REGISRTRY,
        DocumentType.FOREIGNER_CARD,
        DocumentType.MILITARY_ID,
        DocumentType.IDENTITY_CARD,
      ];

      for (const type of validTypes) {
        createUserInput.document_type = type;
        const errors = await validate(createUserInput);
        expect(errors.length).toBe(0);
      }
    });
  });

  describe('document_num validation', () => {
    it('should fail if document_num is not a number', async () => {
      createUserInput.document_num = 'abc' as any;
      const errors = await validate(createUserInput);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail if document_num is negative', async () => {
      createUserInput.document_num = -123;
      const errors = await validate(createUserInput);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'document_num')).toBe(true);
    });

    it('should fail if document_num is zero', async () => {
      createUserInput.document_num = 0;
      const errors = await validate(createUserInput);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('phone validation', () => {
    it('should fail if phone is not a number', async () => {
      createUserInput.phone = 'abc' as any;
      const errors = await validate(createUserInput);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail if phone is negative', async () => {
      createUserInput.phone = -3001234567;
      const errors = await validate(createUserInput);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'phone')).toBe(true);
    });
  });

  describe('email validation', () => {
    it('should fail if email is invalid', async () => {
      createUserInput.email = 'invalid-email';
      const errors = await validate(createUserInput);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('email');
    });

    it('should fail if email is missing @', async () => {
      createUserInput.email = 'invalidemail.com';
      const errors = await validate(createUserInput);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass with valid email formats', async () => {
      const validEmails = ['test@example.com', 'user.name@example.com', 'user+tag@example.co.uk'];

      for (const email of validEmails) {
        createUserInput.email = email;
        const errors = await validate(createUserInput);
        expect(errors.length).toBe(0);
      }
    });
  });

  describe('password validation', () => {
    it('should fail if password is too short', async () => {
      createUserInput.password = 'Abc1';
      const errors = await validate(createUserInput);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });

    it('should fail if password is too long', async () => {
      createUserInput.password = 'A'.repeat(31) + 'bc123';
      const errors = await validate(createUserInput);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail if password has no uppercase letter', async () => {
      createUserInput.password = 'password123';
      const errors = await validate(createUserInput);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });

    it('should fail if password has no lowercase letter', async () => {
      createUserInput.password = 'PASSWORD123';
      const errors = await validate(createUserInput);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail if password has no number or special character', async () => {
      createUserInput.password = 'PasswordOnly';
      const errors = await validate(createUserInput);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass with valid password formats', async () => {
      const validPasswords = ['Password123', 'MyP@ssw0rd', 'Secure123!', 'Test@123'];

      for (const password of validPasswords) {
        createUserInput.password = password;
        const errors = await validate(createUserInput);
        expect(errors.length).toBe(0);
      }
    });
  });

  describe('role validation', () => {
    it('should fail if role is invalid', async () => {
      createUserInput.role = 'InvalidRole' as any;
      const errors = await validate(createUserInput);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'role')).toBe(true);
    });

    it('should pass with valid roles', async () => {
      const validRoles = [UserRoles.Administrador, UserRoles.Estudiante, UserRoles.Docente];

      for (const role of validRoles) {
        createUserInput.role = role;
        const errors = await validate(createUserInput);
        expect(errors.length).toBe(0);
      }
    });

    it('should default to Estudiante role', () => {
      const newInput = new CreateUserInput();
      expect(newInput.role).toBe(UserRoles.Estudiante);
    });
  });
});
