import { validate } from 'class-validator';
import { UpdateUserInput } from 'src/user/dto/inputs/update-user.input';
import { DocumentType } from 'src/auth/enums/user-document-type.enum';
import { UserRoles } from 'src/auth/enums';

describe('UpdateUserInput', () => {
  let updateUserInput: UpdateUserInput;

  beforeEach(() => {
    updateUserInput = new UpdateUserInput();
    updateUserInput.id = '123e4567-e89b-12d3-a456-426614174000';
    updateUserInput.name = 'John';
    updateUserInput.last_name = 'Doe';
    updateUserInput.document_type = DocumentType.CITIZENSHIP_CARD;
    updateUserInput.document_num = 123456789;
    updateUserInput.phone = 3001234567;
    updateUserInput.email = 'john.doe@example.com';
    updateUserInput.role = UserRoles.Estudiante;
    updateUserInput.isActive = true;
  });

  it('should pass validation with valid data', async () => {
    const errors = await validate(updateUserInput);
    expect(errors.length).toBe(0);
  });

  describe('id validation', () => {
    it('should fail if id is not a valid UUID', async () => {
      updateUserInput.id = 'invalid-uuid';
      const errors = await validate(updateUserInput);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'id')).toBe(true);
    });

    it('should pass with valid UUID formats', async () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        '550e8400-e29b-41d4-a716-446655440000',
      ];

      for (const uuid of validUUIDs) {
        updateUserInput.id = uuid;
        const errors = await validate(updateUserInput);
        expect(errors.length).toBe(0);
      }
    });
  });

  describe('role validation', () => {
    it('should fail if role is invalid', async () => {
      updateUserInput.role = 'InvalidRole' as any;
      const errors = await validate(updateUserInput);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'role')).toBe(true);
    });

    it('should pass with valid roles', async () => {
      const validRoles = [UserRoles.Administrador, UserRoles.Estudiante, UserRoles.Docente];

      for (const role of validRoles) {
        updateUserInput.role = role;
        const errors = await validate(updateUserInput);
        expect(errors.length).toBe(0);
      }
    });
  });

  describe('isActive validation', () => {
    it('should fail if isActive is not a boolean', async () => {
      updateUserInput.isActive = 'true' as any;
      const errors = await validate(updateUserInput);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass with boolean values', async () => {
      updateUserInput.isActive = true;
      let errors = await validate(updateUserInput);
      expect(errors.length).toBe(0);

      updateUserInput.isActive = false;
      errors = await validate(updateUserInput);
      expect(errors.length).toBe(0);
    });
  });

  describe('optional fields', () => {
    it('should pass validation with only required fields', async () => {
      const minimalInput = new UpdateUserInput();
      minimalInput.id = '123e4567-e89b-12d3-a456-426614174000';
      minimalInput.role = UserRoles.Estudiante;
      minimalInput.isActive = true;

      const errors = await validate(minimalInput);
      expect(errors.length).toBe(0);
    });

    it('should pass validation when updating only name', async () => {
      const partialInput = new UpdateUserInput();
      partialInput.id = '123e4567-e89b-12d3-a456-426614174000';
      partialInput.name = 'Jane';
      partialInput.role = UserRoles.Estudiante;
      partialInput.isActive = true;

      const errors = await validate(partialInput);
      expect(errors.length).toBe(0);
    });

    it('should pass validation when updating only email', async () => {
      const partialInput = new UpdateUserInput();
      partialInput.id = '123e4567-e89b-12d3-a456-426614174000';
      partialInput.email = 'newemail@example.com';
      partialInput.role = UserRoles.Estudiante;
      partialInput.isActive = true;

      const errors = await validate(partialInput);
      expect(errors.length).toBe(0);
    });
  });

  describe('password validation (if provided)', () => {
    it('should fail if password is too short', async () => {
      updateUserInput.password = 'Abc1';
      const errors = await validate(updateUserInput);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });

    it('should fail if password is too long', async () => {
      updateUserInput.password = 'A'.repeat(31) + 'bc123';
      const errors = await validate(updateUserInput);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass with valid password', async () => {
      updateUserInput.password = 'NewPassword123';
      const errors = await validate(updateUserInput);
      expect(errors.length).toBe(0);
    });

    it('should pass when password is not provided', async () => {
      delete updateUserInput.password;
      const errors = await validate(updateUserInput);
      expect(errors.length).toBe(0);
    });
  });

  describe('email validation (if provided)', () => {
    it('should fail if email is invalid', async () => {
      updateUserInput.email = 'invalid-email';
      const errors = await validate(updateUserInput);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'email')).toBe(true);
    });

    it('should pass with valid email', async () => {
      updateUserInput.email = 'newemail@example.com';
      const errors = await validate(updateUserInput);
      expect(errors.length).toBe(0);
    });
  });

  describe('document_num validation (if provided)', () => {
    it('should fail if document_num is negative', async () => {
      updateUserInput.document_num = -123;
      const errors = await validate(updateUserInput);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass with valid document_num', async () => {
      updateUserInput.document_num = 987654321;
      const errors = await validate(updateUserInput);
      expect(errors.length).toBe(0);
    });
  });

  describe('phone validation (if provided)', () => {
    it('should fail if phone is negative', async () => {
      updateUserInput.phone = -3001234567;
      const errors = await validate(updateUserInput);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass with valid phone', async () => {
      updateUserInput.phone = 3109876543;
      const errors = await validate(updateUserInput);
      expect(errors.length).toBe(0);
    });
  });
});
