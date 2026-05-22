import { prisma } from "@/lib/prisma";

export async function logAdminActivity(args: {
  adminUserId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  targetLabel?: string | null;
  metadata?: unknown;
}) {
  try {
    await prisma.adminActivityLog.create({
      data: {
        adminUserId: args.adminUserId,
        action: args.action,
        targetType: args.targetType,
        targetId: args.targetId ?? null,
        targetLabel: args.targetLabel ?? null,
        metadata: args.metadata === undefined ? null : (args.metadata as any)
      }
    });
  } catch (error) {
    console.error("Admin activity log failed", {
      action: args.action,
      targetType: args.targetType,
      targetId: args.targetId,
      error
    });
  }
}
