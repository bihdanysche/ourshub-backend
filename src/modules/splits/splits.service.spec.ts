import { Test, TestingModule } from '@nestjs/testing';
import { CrewMemberRole } from 'src/modules/crews/enums/crew-member-role.enum';
import { PrismaService } from 'src/prisma/prisma.service';
import { SplitErrorCode } from './errors/split-error.code.enum';
import { SplitsHelperService } from './services/splits-helper.service';
import { SplitsManagementService } from './services/splits-management.service';
import { SplitsPaymentService } from './services/splits-payment.service';
import { SplitsQueryService } from './services/splits-query.service';
import { SplitsService } from './splits.service';

describe('SplitsService', () => {
  let service: SplitsService;

  const mockPrismaService = {
    crewMember: {
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    split: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    splitExpense: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    splitMember: {
      createMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
    expensePayHistory: {
      count: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    expenseRequest: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SplitsHelperService,
        SplitsQueryService,
        SplitsManagementService,
        SplitsPaymentService,
        SplitsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SplitsService>(SplitsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSplits', () => {
    it('should throw CREW_NOT_FOUND if user is not in crew', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue(null);

      const promise = service.getSplits(1, 10, {
        page: 1,
        limit: 10,
        skip: 0,
        isArchived: false,
      });
      await expect(promise).rejects.toMatchObject({
        response: { error_code: SplitErrorCode.CREW_NOT_FOUND },
      });
    });

    it('should return paginated splits for crew member', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        crewId: 10,
        userId: 1,
        role: CrewMemberRole.MEMBER,
      });
      mockPrismaService.split.count.mockResolvedValue(1);

      const mockCreatedAt = new Date();

      mockPrismaService.split.findMany.mockResolvedValue([
        {
          id: 100,
          title: 'Party',
          createdAt: mockCreatedAt,
          expenses: [
            {
              spender: {
                id: 1,
                name: 'V',
                username: 'cyberpunk',
                avatar: 'https://avatar.png',
                crewMembers: [{ alias: 'Choom' }],
              },
              members: [
                { userId: 1, paid: 50, mustPay: 50 },
                { userId: 2, paid: 10, mustPay: 20 },
              ],
            },
          ],
        },
      ]);

      const result = await service.getSplits(1, 10, {
        page: 1,
        limit: 10,
        skip: 0,
        isArchived: false,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: 100,
        title: 'Party',
        createdAt: mockCreatedAt,
        authors: [
          {
            id: 1,
            name: 'V',
            alias: 'Choom',
            username: 'cyberpunk',
            avatar: 'https://avatar.png',
          },
        ],
        totalPaid: 60,
        totalMustPay: 70,
      });
    });
  });

  describe('createSplit', () => {
    it('should throw NOT_A_CREW_MEMBER if specified users are not in crew', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        crewId: 10,
        userId: 1,
        role: CrewMemberRole.MEMBER,
      });
      mockPrismaService.crewMember.count.mockResolvedValue(1); // 1 found, expected 2

      const promise = service.createSplit(1, 10, {
        title: 'Drinks',
        expenses: [
          {
            title: 'Beer',
            spender: 1,
            members: [
              { user: 1, paid: 10, mustPay: 10 },
              { user: 99, paid: 0, mustPay: 10 },
            ],
          },
        ],
      });
      await expect(promise).rejects.toMatchObject({
        response: { error_code: SplitErrorCode.NOT_A_CREW_MEMBER },
      });
    });

    it('should create split with transaction', async () => {
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        crewId: 10,
        userId: 1,
        role: CrewMemberRole.MEMBER,
      });
      mockPrismaService.crewMember.count.mockResolvedValue(2);
      mockPrismaService.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          split: { create: jest.fn().mockResolvedValue({ id: 100 }) },
          splitExpense: { create: jest.fn().mockResolvedValue({ id: 200 }) },
          splitMember: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
        };
        return (await cb(tx));
      });

      const result = await service.createSplit(1, 10, {
        title: 'Drinks',
        expenses: [
          {
            title: 'Beer',
            spender: 1,
            members: [
              { user: 1, paid: 10, mustPay: 10 },
              { user: 2, paid: 0, mustPay: 10 },
            ],
          },
        ],
      });

      expect(result).toEqual({ ok: true });
    });
  });

  describe('payOff', () => {
    it('should throw ONLY_SPENDER_CAN_MODIFY if current user is not expense spender', async () => {
      mockPrismaService.split.findUnique.mockResolvedValue({
        id: 100,
        crewId: 10,
        archived: false,
        expenses: [{ members: [{ userId: 1 }, { userId: 2 }] }],
      });
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        crewId: 10,
        userId: 2,
        role: CrewMemberRole.MEMBER,
      });
      mockPrismaService.splitExpense.findUnique.mockResolvedValue({
        id: 200,
        splitId: 100,
        spenderId: 1, // spender is 1, caller is 2
      });

      const promise = service.payOff(2, 100, 200, [{ user: 2, amount: 5 }]);
      await expect(promise).rejects.toMatchObject({
        response: { error_code: SplitErrorCode.ONLY_SPENDER_CAN_MODIFY },
      });
    });

    it('should throw PAYMENT_EXCEEDS_MUST_PAY if new paid amount exceeds mustPay', async () => {
      mockPrismaService.split.findUnique.mockResolvedValue({
        id: 100,
        crewId: 10,
        archived: false,
        expenses: [{ members: [{ userId: 1 }, { userId: 2 }] }],
      });
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        crewId: 10,
        userId: 1,
        role: CrewMemberRole.MEMBER,
      });
      mockPrismaService.splitExpense.findUnique.mockResolvedValue({
        id: 200,
        splitId: 100,
        spenderId: 1,
      });

      mockPrismaService.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          splitMember: {
            findUnique: jest.fn().mockResolvedValue({
              id: 50,
              paid: 0,
              mustPay: 10,
            }),
          },
        };
        return (await cb(tx));
      });

      const promise = service.payOff(1, 100, 200, [{ user: 2, amount: 15 }]);
      await expect(promise).rejects.toMatchObject({
        response: { error_code: SplitErrorCode.PAYMENT_EXCEEDS_MUST_PAY },
      });
    });
  });

  describe('deleteExpense', () => {
    it('should throw MIN_EXPENSES_REQUIRED if trying to delete sole expense in split', async () => {
      mockPrismaService.split.findUnique.mockResolvedValue({
        id: 100,
        crewId: 10,
        archived: false,
        expenses: [{ id: 200, spenderId: 1, members: [{ userId: 1 }] }],
      });
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        crewId: 10,
        userId: 1,
        role: CrewMemberRole.MEMBER,
      });
      mockPrismaService.splitExpense.findUnique.mockResolvedValue({
        id: 200,
        splitId: 100,
        spenderId: 1,
      });

      const promise = service.deleteExpense(1, 100, 200);
      await expect(promise).rejects.toMatchObject({
        response: { error_code: SplitErrorCode.MIN_EXPENSES_REQUIRED },
      });
    });
  });

  describe('createExpenseRequest', () => {
    it('should throw REQUEST_AMOUNT_EXCEEDS_REMAINING_DEBT if requested amount exceeds remaining debt', async () => {
      mockPrismaService.split.findUnique.mockResolvedValue({
        id: 100,
        crewId: 10,
        archived: false,
        expenses: [{ members: [{ userId: 2 }] }],
      });
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        crewId: 10,
        userId: 2,
        role: CrewMemberRole.MEMBER,
      });
      mockPrismaService.splitExpense.findUnique.mockResolvedValue({
        id: 200,
        splitId: 100,
        spenderId: 1, // spender is 1, requester is 2
      });
      mockPrismaService.splitMember.findUnique.mockResolvedValue({
        id: 50,
        userId: 2,
        paid: 0,
        mustPay: 20,
      });
      mockPrismaService.expenseRequest.findMany.mockResolvedValue([
        { amount: 15 }, // 15 already pending, remaining debt = 5
      ]);

      const promise = service.createExpenseRequest(2, 100, 200, { amount: 10 });
      await expect(promise).rejects.toMatchObject({
        response: {
          error_code: SplitErrorCode.REQUEST_AMOUNT_EXCEEDS_REMAINING_DEBT,
        },
      });
    });

    it('should create expense request successfully', async () => {
      mockPrismaService.split.findUnique.mockResolvedValue({
        id: 100,
        crewId: 10,
        archived: false,
        expenses: [{ members: [{ userId: 2 }] }],
      });
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        crewId: 10,
        userId: 2,
        role: CrewMemberRole.MEMBER,
      });
      mockPrismaService.splitExpense.findUnique.mockResolvedValue({
        id: 200,
        splitId: 100,
        spenderId: 1,
      });
      mockPrismaService.splitMember.findUnique.mockResolvedValue({
        id: 50,
        userId: 2,
        paid: 0,
        mustPay: 20,
      });
      mockPrismaService.expenseRequest.findMany.mockResolvedValue([]);
      mockPrismaService.expenseRequest.create.mockResolvedValue({ id: 1 });

      const result = await service.createExpenseRequest(2, 100, 200, {
        amount: 15,
        msg: 'Paid 15 UAH',
      });

      expect(result).toEqual({ ok: true });
    });
  });

  describe('acceptExpenseRequest', () => {
    it('should throw ONLY_SPENDER_CAN_MODIFY if non-spender attempts to accept request', async () => {
      mockPrismaService.split.findUnique.mockResolvedValue({
        id: 100,
        crewId: 10,
        archived: false,
        expenses: [{ members: [{ userId: 2 }] }],
      });
      mockPrismaService.crewMember.findUnique.mockResolvedValue({
        crewId: 10,
        userId: 2,
        role: CrewMemberRole.MEMBER,
      });
      mockPrismaService.expenseRequest.findUnique.mockResolvedValue({
        id: 1,
        expenseId: 200,
        userId: 2,
        amount: 10,
        expense: { id: 200, spenderId: 1 }, // spender is 1, caller is 2
      });

      const promise = service.acceptExpenseRequest(2, 100, 200, 1);
      await expect(promise).rejects.toMatchObject({
        response: { error_code: SplitErrorCode.ONLY_SPENDER_CAN_MODIFY },
      });
    });
  });
});
