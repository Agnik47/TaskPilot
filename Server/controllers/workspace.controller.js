import prisma from '../config/prisma.js';
import clerkClient from '../config/clerk.js';

// Workspace-level preferences live in the Clerk organization's publicMetadata
// (Clerk already owns the workspace record), so no local table is needed.
// publicMetadata is only writable server-side, which keeps owner-only
// enforcement here rather than in the client.
const DEFAULT_SETTINGS = {
  defaultTaskPriority: 'MEDIUM',
  defaultTaskType: 'TASK',
  weekStartsOn: 0, // 0 = Sunday, 1 = Monday
  defaultTaskView: 'table', // 'table' | 'sheet' — how a project's tasks open
};

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const TASK_TYPES = ['TASK', 'BUG', 'FEATURE', 'IMPROVEMENT', 'OTHER'];
const WEEK_STARTS = [0, 1];
const TASK_VIEWS = ['table', 'sheet'];

function readSettings(org) {
  return { ...DEFAULT_SETTINGS, ...(org.publicMetadata?.settings || {}) };
}

export async function getSettings(req, res, next) {
  try {
    const org = await clerkClient.organizations.getOrganization({ organizationId: req.workspaceId });
    res.json(readSettings(org));
  } catch (err) {
    next(err);
  }
}

export async function updateSettings(req, res, next) {
  try {
    const { defaultTaskPriority, defaultTaskType, weekStartsOn, defaultTaskView } = req.body;
    const changes = {};

    if (defaultTaskPriority !== undefined) {
      if (!PRIORITIES.includes(defaultTaskPriority)) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid default priority.' });
      }
      changes.defaultTaskPriority = defaultTaskPriority;
    }

    if (defaultTaskType !== undefined) {
      if (!TASK_TYPES.includes(defaultTaskType)) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid default task type.' });
      }
      changes.defaultTaskType = defaultTaskType;
    }

    if (weekStartsOn !== undefined) {
      if (!WEEK_STARTS.includes(weekStartsOn)) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Week must start on Sunday or Monday.' });
      }
      changes.weekStartsOn = weekStartsOn;
    }

    if (defaultTaskView !== undefined) {
      if (!TASK_VIEWS.includes(defaultTaskView)) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Default task view must be table or sheet.' });
      }
      changes.defaultTaskView = defaultTaskView;
    }

    const org = await clerkClient.organizations.getOrganization({ organizationId: req.workspaceId });
    const settings = { ...readSettings(org), ...changes };

    await clerkClient.organizations.updateOrganizationMetadata(req.workspaceId, {
      publicMetadata: { settings },
    });

    res.json(settings);
  } catch (err) {
    next(err);
  }
}

// Deletes all local workspace data, then the Clerk organization itself.
// Local rows go first so a failure never leaves data for a workspace that
// no longer exists in Clerk.
export async function deleteWorkspace(req, res, next) {
  try {
    const workspaceId = req.workspaceId;
    const org = await clerkClient.organizations.getOrganization({ organizationId: workspaceId });

    if (req.body?.confirmName !== org.name) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Workspace name confirmation does not match.' });
    }

    await prisma.$transaction([
      prisma.notification.deleteMany({ where: { workspaceId } }),
      prisma.activity.deleteMany({ where: { workspaceId } }),
      prisma.comment.deleteMany({ where: { workspaceId } }),
      prisma.task.deleteMany({ where: { workspaceId } }),
      prisma.project.deleteMany({ where: { workspaceId } }),
    ]);

    await clerkClient.organizations.deleteOrganization(workspaceId);

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
