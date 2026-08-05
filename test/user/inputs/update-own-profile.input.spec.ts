import { validate } from 'class-validator';
import { DocumentType } from 'src/auth/enums';
import { UpdateOwnProfileInput } from 'src/user/dto';

describe('UpdateOwnProfileInput', () => {
  it('accepts only valid personal profile values', async () => {
    const input = new UpdateOwnProfileInput();
    input.name = 'Andrea';
    input.last_name = 'Rojas';
    input.document_type = DocumentType.CITIZENSHIP_CARD;
    input.document_num = 123456789;
    input.phone = 3001234567;
    input.email = 'andrea@example.com';

    await expect(validate(input)).resolves.toHaveLength(0);
  });

  it('rejects invalid personal profile values', async () => {
    const input = new UpdateOwnProfileInput();
    input.email = 'correo-invalido';
    input.phone = -1;

    const errors = await validate(input);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['email', 'phone'])
    );
  });
});
