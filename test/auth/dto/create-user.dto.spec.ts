import { validate } from 'class-validator';
import { CreateUserDto } from 'src/auth/dto/create-user.dto';
import { DocumentType, UserRoles } from 'src/auth/enums';

describe('CreateUserDto', () => {
  let createUserDto: CreateUserDto;

  beforeEach(() => {
    createUserDto = new CreateUserDto();
    createUserDto.name = 'John';
    createUserDto.last_name = 'Doe';
    createUserDto.document_type = DocumentType.CITIZENSHIP_CARD;
    createUserDto.document_num = 123456789;
    createUserDto.phone = 3001234567;
    createUserDto.email = 'john.doe@example.com';
    createUserDto.password = 'Password123';
    createUserDto.role = UserRoles.Estudiante;
  });

  it('should pass validation with valid data', async () => {
    const errors = await validate(createUserDto);
    expect(errors.length).toBe(0);
  });

  describe('name validation', () => {
    it('should fail if name is empty', async () => {
      createUserDto.name = '';
      const errors = await validate(createUserDto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('name');
    });

    it('should fail if name is not a string', async () => {
      createUserDto.name = 123 as any;
      const errors = await validate(createUserDto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('last_name validation', () => {
    it('should fail if last_name is empty', async () => {
      createUserDto.last_name = '';
      const errors = await validate(createUserDto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('last_name');
    });
  });

  describe('document_type validation', () => {
    it('should fail if document_type is invalid', async () => {
      createUserDto.document_type = 'InvalidType' as any;
      const errors = await validate(createUserDto);
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
        createUserDto.document_type = type;
        const errors = await validate(createUserDto);
        expect(errors.length).toBe(0);
      }
    });
  });

  describe('document_num validation', () => {
    it('should fail if document_num is not a number', async () => {
      createUserDto.document_num = 'abc' as any;
      const errors = await validate(createUserDto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail if document_num is negative', async () => {
      createUserDto.document_num = -123;
      const errors = await validate(createUserDto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'document_num')).toBe(true);
    });

    it('should fail if document_num is zero', async () => {
      createUserDto.document_num = 0;
      const errors = await validate(createUserDto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('phone validation', () => {
    it('should fail if phone is not a number', async () => {
      createUserDto.phone = 'abc' as any;
      const errors = await validate(createUserDto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail if phone is negative', async () => {
      createUserDto.phone = -3001234567;
      const errors = await validate(createUserDto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'phone')).toBe(true);
    });
  });

  describe('email validation', () => {
    it('should fail if email is invalid', async () => {
      createUserDto.email = 'invalid-email';
      const errors = await validate(createUserDto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('email');
    });

    it('should fail if email is missing @', async () => {
      createUserDto.email = 'invalidemail.com';
      const errors = await validate(createUserDto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass with valid email formats', async () => {
      const validEmails = ['test@example.com', 'user.name@example.com', 'user+tag@example.co.uk'];

      for (const email of validEmails) {
        createUserDto.email = email;
        const errors = await validate(createUserDto);
        expect(errors.length).toBe(0);
      }
    });
  });

  describe('password validation', () => {
    it('should fail if password is too short', async () => {
      createUserDto.password = 'Abc1';
      const errors = await validate(createUserDto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });

    it('should fail if password is too long', async () => {
      createUserDto.password = 'A'.repeat(31) + 'bc123';
      const errors = await validate(createUserDto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail if password has no uppercase letter', async () => {
      createUserDto.password = 'password123';
      const errors = await validate(createUserDto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });

    it('should fail if password has no lowercase letter', async () => {
      createUserDto.password = 'PASSWORD123';
      const errors = await validate(createUserDto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail if password has no number or special character', async () => {
      createUserDto.password = 'PasswordOnly';
      const errors = await validate(createUserDto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass with valid password formats', async () => {
      const validPasswords = ['Password123', 'MyP@ssw0rd', 'Secure123!', 'Test@123'];

      for (const password of validPasswords) {
        createUserDto.password = password;
        const errors = await validate(createUserDto);
        expect(errors.length).toBe(0);
      }
    });
  });

  describe('role validation', () => {
    it('should pass with valid roles', async () => {
      const validRoles = [UserRoles.Administrador, UserRoles.Estudiante, UserRoles.Docente];

      for (const role of validRoles) {
        createUserDto.role = role;
        const errors = await validate(createUserDto);
        expect(errors.length).toBe(0);
      }
    });
  });
});
