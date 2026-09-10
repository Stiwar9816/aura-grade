/** Runs only against the disposable PostgreSQL started for security verification. */
import * as assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';

async function main() {
  Object.assign(process.env, {
    STATE: 'dev',
    DB_HOST: '127.0.0.1',
    DB_PORT: '55439',
    DB_NAME: 'aura_security_check',
    DB_USERNAME: 'postgres',
    DB_PASSWORD: 'aura-local-test-only',
    DB_SSL_MODE: 'disable',
    BOOTSTRAP_INSTITUTION_NAME: 'Security Test Institution',
    BOOTSTRAP_INSTITUTION_SLUG: 'security-test',
    BOOTSTRAP_INSTITUTION_EMAIL_DOMAIN: 'example.test',
    BOOTSTRAP_ADMIN_EMAIL: 'admin@example.test',
    BOOTSTRAP_ADMIN_PASSWORD: 'SecurityTestOnly12345',
    BOOTSTRAP_ADMIN_NAME: 'Security',
    BOOTSTRAP_ADMIN_LAST_NAME: 'Test',
    BOOTSTRAP_ADMIN_DOCUMENT_NUM: '1122334455',
    BOOTSTRAP_ADMIN_PHONE: '3001122334',
  });
  const { AppDataSource: db } = await import('../src/config/datasource.config');
  const { User } = await import('../src/user/entities/user.entity');
  const { PasswordResetService } = await import('../src/auth/security/password-reset.service');
  const { PasswordService } = await import('../src/auth/security/password.service');
  await db.initialize();
  try {
    const applied = await db.runMigrations();
    const second = await db.runMigrations();
    assert.equal(second.length, 0);
    console.log(`Migrations: ${applied.length} applied; second run is idempotent.`);
    const users = db.getRepository(User);
    await users.update(
      { email: 'admin@example.test' },
      { passwordResetRequestedAt: null, passwordResetTokenHash: null, passwordResetExpiresAt: null }
    );
    const user = await users.findOneByOrFail({ email: 'admin@example.test' });
    let token = '';
    let emails = 0;
    const mail = {
      sendResetPassword: async (_user: unknown, value: string) => {
        token = value;
        emails++;
      },
      sendUpdatePassword: async () => {},
    };
    const passwords = new PasswordService();
    const service = new PasswordResetService(users, passwords, mail as never);
    await service.request(user.email);
    const afterRequest = await users.findOne({
      where: { id: user.id },
      select: { id: true, password: true, authVersion: true, passwordResetTokenHash: true },
    });
    assert.equal(afterRequest.authVersion, user.authVersion);
    assert.equal(
      afterRequest.passwordResetTokenHash,
      createHash('sha256').update(token).digest('hex')
    );
    const validToken = token;
    await service.request(user.email);
    assert.equal(emails, 1, 'per-account cooldown must prevent duplicate email');
    await service.request('missing@example.test');
    assert.equal(emails, 1);
    const outcomes = await Promise.allSettled([
      service.complete(validToken, 'UniqueSecurityPassword2026'),
      service.complete(validToken, 'OtherSecurityPassword2026'),
    ]);
    assert.equal(
      outcomes.filter((result) => result.status === 'fulfilled').length,
      1,
      'token must be single-use under concurrency'
    );
    const updated = await users.findOne({
      where: { id: user.id },
      select: { id: true, password: true, authVersion: true, passwordResetTokenHash: true },
    });
    assert.equal(updated.authVersion, user.authVersion + 1);
    assert.equal(updated.passwordResetTokenHash, null);
    assert.ok(
      (await passwords.verify('UniqueSecurityPassword2026', updated.password)) ||
        (await passwords.verify('OtherSecurityPassword2026', updated.password))
    );
    console.log(
      'Password reset: no account change on request; hashed token; account cooldown; concurrent single redemption; session invalidation.'
    );
    const { recordOutboxEvent } = await import('../src/outbox/outbox');
    const { OutboxEvent } = await import('../src/outbox/entities/outbox-event.entity');
    const eventId = 'grade-published-' + user.id;
    await db.getRepository(OutboxEvent).delete(eventId);
    await assert.rejects(
      db.transaction(async (manager) => {
        await recordOutboxEvent(manager, 'grade-published', user.id);
        throw new Error('rollback');
      })
    );
    assert.equal(await db.getRepository(OutboxEvent).countBy({ id: eventId }), 0);
    await db.transaction(async (manager) => {
      await recordOutboxEvent(manager, 'grade-published', user.id);
      await recordOutboxEvent(manager, 'grade-published', user.id);
    });
    assert.equal(await db.getRepository(OutboxEvent).countBy({ id: eventId }), 1);
    console.log('Outbox: transaction rollback and duplicate event protection verified.');
    const { OutboxService } = await import('../src/outbox/outbox.service');
    let dispatches = 0;
    let queueDown = false;
    let jobExists = true;
    const queue = {
      add: async () => {
        if (queueDown) throw new Error('Simulated outage');
        dispatches++;
      },
      getJob: async () => (jobExists ? {} : undefined),
    };
    const workerA = new OutboxService(db, queue as never, queue as never);
    const workerB = new OutboxService(db, queue as never, queue as never);
    await Promise.all([workerA.flush(), workerB.flush()]);
    assert.equal(dispatches, 1, 'concurrent dispatchers must claim an event only once');
    assert.ok((await db.getRepository(OutboxEvent).findOneByOrFail({ id: eventId })).dispatchedAt);
    await db.getRepository(OutboxEvent).update(eventId, { dispatchedAt: null });
    queueDown = true;
    await workerA.flush();
    const failedEvent = await db.getRepository(OutboxEvent).findOneByOrFail({ id: eventId });
    assert.equal(failedEvent.dispatchedAt, null);
    assert.equal(failedEvent.leaseToken, null, 'a failed dispatch releases its lease');
    queueDown = false;
    await workerB.flush();
    assert.equal(dispatches, 2);
    await db
      .getRepository(OutboxEvent)
      .update(eventId, { dispatchedAt: new Date(Date.now() - 600000) });
    jobExists = false;
    await workerA.flush();
    assert.equal(
      (await db.getRepository(OutboxEvent).findOneByOrFail({ id: eventId })).dispatchedAt,
      null,
      'lost Redis notification must be reconciled'
    );
    await workerB.flush();
    assert.equal(dispatches, 3);
    console.log(
      'Outbox: concurrent leases, queue outage retry and Redis loss reconciliation verified.'
    );
    const { Assignment } = await import('../src/assignment/entities/assignment.entity');
    const { AssignmentExtension } =
      await import('../src/assignment/entities/assignment-extension.entity');
    const { AssignmentService } = await import('../src/assignment/assignment.service');
    const { Course } = await import('../src/course/entities/course.entity');
    const { Rubric } = await import('../src/rubric/entities/rubric.entity');
    const { Submission } = await import('../src/submission/entities/submission.entity');
    const { Evaluation } = await import('../src/evaluation/entities/evaluation.entity');
    const { SubmissionService } = await import('../src/submission/submission.service');
    const { UserRoles } = await import('../src/auth/enums');
    const { EvaluationStatus } = await import('../src/enums');
    const makeUser = async (email: string, role: typeof user.role, number: number) =>
      (await users.findOneBy({ email })) ||
      (await users.save(
        users.create({
          ...user,
          id: randomUUID(),
          email,
          role,
          isPlatformAdmin: false,
          password: updated.password,
          phone: number,
          document_num: number,
        })
      ));
    const teacher = await makeUser('teacher@example.test', UserRoles.Docente, 3000000001);
    const student = await makeUser('student@example.test', UserRoles.Estudiante, 3000000002);
    const courses = db.getRepository(Course),
      assignments = db.getRepository(Assignment),
      submissions = db.getRepository(Submission),
      rubrics = db.getRepository(Rubric);
    const course = await courses.save(
      courses.create({
        course_name: 'Security course',
        code_course: randomUUID(),
        user: teacher,
        users: [student],
      })
    );
    const rubric = await rubrics.save(
      rubrics.create({ title: 'Security rubric', maxTotalScore: 5, user: teacher })
    );
    const assignment = await assignments.save(
      assignments.create({
        title: 'Security task',
        description: 'Synthetic',
        dueDate: new Date(Date.now() + 600000),
        user: teacher,
        course,
        rubric,
      })
    );
    const parts: Buffer[] = [],
      directory: Buffer[] = [];
    let offset = 0;
    for (const name of ['[Content_Types].xml', 'word/document.xml']) {
      const filename = Buffer.from(name),
        local = Buffer.alloc(30),
        central = Buffer.alloc(46);
      local.writeUInt32LE(0x04034b50);
      local.writeUInt32LE(1, 18);
      local.writeUInt32LE(1, 22);
      local.writeUInt16LE(filename.length, 26);
      central.writeUInt32LE(0x02014b50);
      central.writeUInt32LE(1, 20);
      central.writeUInt32LE(1, 24);
      central.writeUInt16LE(filename.length, 28);
      central.writeUInt32LE(offset, 42);
      const part = Buffer.concat([local, filename, Buffer.from('x')]);
      parts.push(part);
      offset += part.length;
      directory.push(Buffer.concat([central, filename]));
    }
    const central = Buffer.concat(directory),
      end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50);
    end.writeUInt16LE(2, 8);
    end.writeUInt16LE(2, 10);
    end.writeUInt32LE(central.length, 12);
    end.writeUInt32LE(offset, 16);
    const docx = Buffer.concat([...parts, central, end]);
    let uploads = 0,
      deleted = 0;
    const storage = {
      uploadSubmission: async () => {
        uploads++;
        const publicId = `auragrade/submissions/${randomUUID()}.docx`;
        return { publicId, secureUrl: 'https://example.test/private.docx' };
      },
      deleteSubmission: async () => {
        deleted++;
      },
    };
    const submissionService = new SubmissionService(
      submissions,
      assignments,
      {} as never,
      storage as never,
      {} as never,
      { extractFromBuffer: async () => 'Academic content: terminal and system.' } as never
    );
    const file = () => ({
      filename: 'test.docx',
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      createReadStream: () => Readable.from(docx),
    });
    const input = { assignmentId: assignment.id, idempotencyKey: randomUUID() };
    const concurrent = await Promise.all([
      submissionService.create(file() as never, input, student),
      submissionService.create(file() as never, input, student),
    ]);
    assert.equal(concurrent[0].id, concurrent[1].id);
    assert.equal(await submissions.countBy({ assignment: { id: assignment.id } }), 1);
    assert.equal(uploads - deleted, 1, 'only one uploaded asset is retained');
    const submission = concurrent[0];
    assert.equal(await db.getRepository(OutboxEvent).countBy({ aggregateId: submission.id }), 2);
    const assignmentService = new AssignmentService(
      assignments,
      db.getRepository(AssignmentExtension),
      courses,
      {} as never
    );
    await assert.rejects(
      assignmentService.update(
        assignment.id,
        { id: assignment.id, courseId: randomUUID() },
        teacher
      ),
      /ya tiene entregas/
    );
    await assert.rejects(assignmentService.remove(assignment.id, teacher), /Desactívala/);
    await assert.rejects(
      submissionService.download(submission.id, users.create({ ...student, id: teacher.id })),
      /No puedes acceder/
    );
    await db.getRepository(Evaluation).save({
      submission,
      totalScore: 4,
      generalFeedback: 'Synthetic published result',
      detailedFeedback: [],
      status: EvaluationStatus.PUBLISHED,
    });
    await assert.rejects(
      submissionService.create(
        file() as never,
        { assignmentId: assignment.id, idempotencyKey: randomUUID() },
        student
      ),
      /ya fue calificada/
    );
    await db.getRepository(OutboxEvent).delete({ aggregateId: submission.id });
    await submissions.delete(submission.id);
    await assignments.delete(assignment.id);
    await courses.delete(course.id);
    await rubrics.delete(rubric.id);
    console.log(
      'Submissions: concurrent idempotency, private access, durable events, frozen assignments and post-publication rejection verified.'
    );

    await db.getRepository(OutboxEvent).delete(eventId);
  } finally {
    await db.destroy();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Security verification failed');
  process.exitCode = 1;
});
