import prisma from '../config/prisma.js';
import { filterTasksForRole } from '../services/authorization.service.js';

const projectInclude = {
  members: { include: { user: true } },
  tasks: { include: { assignee: true, creator: true }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
};

function shapeProject(project, dbUserId, orgRole) {
  return {
    ...project,
    tasks: filterTasksForRole(dbUserId, orgRole, project.tasks),
  };
}

export async function listProjects(req, res, next) {
  try {
    const projects = await prisma.project.findMany({
      where: { workspaceId: req.workspaceId },
      include: projectInclude,
      orderBy: { createdAt: 'desc' },
    });

    res.json(projects.map((p) => shapeProject(p, req.dbUser.id, req.orgRole)));
  } catch (err) {
    next(err);
  }
}

export async function getProject(req, res, next) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: projectInclude,
    });

    if (!project || project.workspaceId !== req.workspaceId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Project not found.' });
    }

    res.json(shapeProject(project, req.dbUser.id, req.orgRole));
  } catch (err) {
    next(err);
  }
}

export async function createProject(req, res, next) {
  try {
    const { name, description, priority, status, start_date, end_date, team_lead, progress, team_members } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Project name is required.' });
    }

    const leadId = team_lead || req.dbUser.id;
    const memberIds = new Set([leadId, ...(Array.isArray(team_members) ? team_members : [])]);

    const project = await prisma.project.create({
      data: {
        workspaceId: req.workspaceId,
        name,
        description,
        priority,
        status,
        start_date: start_date ? new Date(start_date) : undefined,
        end_date: end_date ? new Date(end_date) : undefined,
        team_lead: leadId,
        progress: progress ?? 0,
        members: {
          create: [...memberIds].map((userId) => ({ userId })),
        },
      },
      include: projectInclude,
    });

    res.status(201).json(shapeProject(project, req.dbUser.id, req.orgRole));
  } catch (err) {
    next(err);
  }
}

export async function updateProject(req, res, next) {
  try {
    const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.workspaceId !== req.workspaceId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Project not found.' });
    }

    const { name, description, priority, status, start_date, end_date, team_lead, progress } = req.body;

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        name,
        description,
        priority,
        status,
        start_date: start_date ? new Date(start_date) : undefined,
        end_date: end_date ? new Date(end_date) : undefined,
        team_lead,
        progress,
      },
      include: projectInclude,
    });

    res.json(shapeProject(project, req.dbUser.id, req.orgRole));
  } catch (err) {
    next(err);
  }
}

export async function deleteProject(req, res, next) {
  try {
    const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.workspaceId !== req.workspaceId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Project not found.' });
    }

    await prisma.project.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function addProjectMember(req, res, next) {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'userId is required.' });
    }

    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project || project.workspaceId !== req.workspaceId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Project not found.' });
    }

    const member = await prisma.projectMember.upsert({
      where: { userId_projectId: { userId, projectId: req.params.id } },
      update: {},
      create: { userId, projectId: req.params.id },
      include: { user: true },
    });

    res.status(201).json(member);
  } catch (err) {
    next(err);
  }
}

export async function removeProjectMember(req, res, next) {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project || project.workspaceId !== req.workspaceId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Project not found.' });
    }

    await prisma.projectMember.delete({
      where: { userId_projectId: { userId: req.params.userId, projectId: req.params.id } },
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
