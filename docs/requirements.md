# Wishkaro Work Management Platform --- Product Requirements

## 1. Product Overview

Build an internal work-management platform for a small organization such
as Wishkaro.

The product should replace the current combination of: - Excel-based
task tracking - Verbal task assignment - Physical/in-person status
updates - Lack of centralized visibility into employee work

The goal is to give owners/managers a clear view of organizational work
while giving employees a simple place to manage their own work.

This is **not intended to be a Jira clone**. It should be simpler,
easier to understand, and appropriate for a small team of roughly 10--15
office employees.

The existing application is an early prototype with a working frontend
structure and basic CRUD functionality built using a PERN stack. The
existing product structure, UI, reusable components, routes, data
models, and working functionality should be understood and preserved
where useful rather than discarded unnecessarily.

------------------------------------------------------------------------

## 2. Product Principles

The platform should follow these principles:

1.  **Simple enough for non-technical employees**
2.  **Owner visibility without micromanagement**
3.  **Clear ownership of every task**
4.  **Employees can manage their own work**
5.  **Employees cannot modify or manage another employee's work**
6.  **Owners can assign and manage team work**
7.  **Every important action should have a clear status**
8.  **Work should be understandable without asking someone verbally**
9.  **The system should support real organizational workflows**
10. **The UI should remain clean and lightweight rather than becoming an
    enterprise project-management product**

------------------------------------------------------------------------

# 3. User Roles

The platform must support two primary roles.

## 3.1 Owner

The owner is the organization/workspace administrator.

The owner can:

-   Create and manage a workspace/company
-   Invite employees
-   Manage employees
-   View all employees
-   View all projects
-   View all tasks
-   Create tasks
-   Assign tasks to employees
-   Reassign tasks
-   Change task priority
-   Change task status
-   Edit task details
-   Set due dates
-   Create and manage projects
-   View employee activity
-   View task completion information
-   View overdue work
-   View team workload
-   View productivity/task analytics
-   View the team leaderboard
-   Manage workspace-level settings
-   Remove or deactivate employees
-   View task history/activity where appropriate

The owner should have organization-wide visibility.

------------------------------------------------------------------------

## 3.2 Employee

Employees are normal members of the workspace.

Employees can:

-   Join a workspace through an owner-provided invitation/join mechanism
-   View their assigned tasks
-   View tasks they personally created
-   Create tasks for themselves
-   Edit their own self-created tasks
-   Update the status of tasks they are responsible for
-   Add comments to tasks they have access to
-   View relevant task/project information
-   Set or update appropriate personal task details
-   Mark their work as completed
-   View their own activity
-   View team information that is intentionally visible to employees

Employees must NOT be able to:

-   Assign tasks to another employee
-   Reassign another employee's task
-   Edit another employee's task ownership
-   Manage workspace members
-   Delete organization data
-   Access owner-only analytics
-   Change workspace settings
-   Change another employee's permissions
-   Create tasks on behalf of another employee

------------------------------------------------------------------------

# 4. Authentication and Authorization

The application must have clear authentication and authorization.

There are two primary authorization levels:

### Owner

Full workspace-level management access.

### Employee

Restricted workspace-member access.

Authorization must be enforced consistently throughout the application.

The frontend should not be the only source of authorization rules.
Sensitive actions must respect the user's actual role and ownership of
resources.

A user should only be able to access data belonging to their authorized
workspace.

------------------------------------------------------------------------

# 5. Workspace / Organization

The platform should be organized around a workspace/company.

Example:

**Wishkaro Workspace**

Inside the workspace:

-   Owner
-   Employees
-   Projects
-   Tasks
-   Activity
-   Analytics

The structure should support future expansion to multiple workspaces
without making the current product unnecessarily complicated.

------------------------------------------------------------------------

# 6. Employee Joining Flow

The owner should have a simple way to bring employees into the
workspace.

Possible business-level flow:

1.  Owner creates workspace.
2.  Owner invites employee.
3.  Employee accepts the invitation or joins using the provided joining
    mechanism.
4.  Employee becomes a member of that workspace.
5.  Employee receives the appropriate employee permissions.

The system should prevent unauthorized users from joining a private
workspace.

------------------------------------------------------------------------

# 7. Dashboard

The dashboard should differ according to role.

## Owner Dashboard

The owner should immediately understand:

-   Total active tasks
-   Completed tasks
-   Tasks in progress
-   Tasks overdue
-   Tasks due today
-   Tasks due soon
-   Number of employees
-   Current workload
-   Recent activity
-   Employee task distribution
-   Team completion information
-   Leaderboard
-   Important blocked or overdue work

The dashboard should answer:

> "What is happening in the company right now?"

without requiring the owner to open every employee's task list.

------------------------------------------------------------------------

## Employee Dashboard

The employee dashboard should answer:

> "What do I need to work on today?"

It should clearly show:

-   My tasks
-   Tasks due today
-   Overdue tasks
-   High-priority tasks
-   In-progress tasks
-   Recently completed tasks
-   Self-created tasks
-   Tasks assigned by owner
-   Upcoming work

The employee should not be overwhelmed by organization-wide information.

------------------------------------------------------------------------

# 8. Task System

Tasks are the central unit of work.

A task should have appropriate information such as:

-   Title
-   Description
-   Creator
-   Assignee
-   Project
-   Priority
-   Status
-   Due date
-   Creation date
-   Completion date
-   Comments
-   Activity/history
-   Attachments where appropriate
-   Task type/category where useful

The exact data structure should be determined after inspecting the
existing application.

------------------------------------------------------------------------

# 9. Task Creation Rules

## Owner-created task

An owner can create a task for:

-   Themselves
-   A specific employee

Example:

> Fix Shopify product image mismatch\
> Assigned to: Agnik\
> Priority: High\
> Due: Today

------------------------------------------------------------------------

## Employee-created task

An employee can create a task for:

-   Themselves only

Example:

> Audit 50 Amazon product SKUs

The employee cannot select another employee as the assignee.

The owner should still be able to see employee-created tasks.

Employee-created tasks should be distinguishable from owner-assigned
tasks where useful.

------------------------------------------------------------------------

# 10. Task Status

The product should have a clear task lifecycle.

The initial status model should support concepts such as:

-   To Do
-   In Progress
-   Blocked / Waiting
-   Completed

The exact status names and transitions can be refined during planning if
the existing application already has a suitable status system.

Tasks should have a clear indication of their current state.

------------------------------------------------------------------------

# 11. Task Priority

Tasks should support priority levels such as:

-   Low
-   Medium
-   High
-   Urgent

Priority should be visually understandable without overwhelming the
interface.

------------------------------------------------------------------------

# 12. Due Dates and Overdue Work

Tasks should support due dates.

The system should clearly identify:

-   Due today
-   Upcoming
-   Overdue
-   Completed before due date
-   Completed after due date

Overdue work should be visible to the owner and relevant employee.

------------------------------------------------------------------------

# 13. Projects

Projects group related work.

Example:

### Amazon Catalog Migration

Tasks:

-   Prepare product data
-   Verify SKU mapping
-   Upload product images
-   Upload catalog
-   Verify listings

Projects should provide a consolidated view of their tasks and progress.

The existing prototype already contains a project-oriented structure, so
the new implementation should build upon it where appropriate.

------------------------------------------------------------------------

# 14. My Tasks

Every employee should have a dedicated personal work view.

It should make it easy to answer:

-   What do I have to do?
-   What is urgent?
-   What is due today?
-   What am I currently working on?
-   What is blocked?
-   What have I completed?

Employees should be able to organize/filter their tasks without
affecting the underlying task ownership.

------------------------------------------------------------------------

# 15. Team / Owner Task View

Owners need a complete team view.

They should be able to filter work by:

-   Employee
-   Project
-   Status
-   Priority
-   Due date
-   Task type
-   Completion state

The owner should be able to quickly identify:

-   Who is working on what
-   Which tasks are unassigned
-   Which tasks are overdue
-   Which employees have too many active tasks
-   Which projects are progressing
-   Which work is blocked

------------------------------------------------------------------------

# 16. Employee Activity

The system should maintain useful activity information.

Examples:

-   Task created
-   Task assigned
-   Task reassigned
-   Status changed
-   Priority changed
-   Comment added
-   Task completed
-   Due date changed

The purpose is transparency and context, not unnecessary surveillance.

------------------------------------------------------------------------

# 17. Comments and Task Communication

Tasks should support communication around the work.

Instead of relying entirely on verbal communication, employees and
owners should be able to leave comments on relevant tasks.

Example:

Employee: \> Waiting for the product images from the photography team.

Owner: \> Images uploaded. Continue with the listing.

The task should retain this context.

------------------------------------------------------------------------

# 18. Notifications

The platform should eventually support useful notifications for events
such as:

-   New task assigned
-   Task reassigned
-   Task approaching due date
-   Task becoming overdue
-   Comment on a task
-   Mention in a task
-   Task completed

Notifications should be useful and not excessive.

------------------------------------------------------------------------

# 19. Leaderboard

The owner should have a small team leaderboard.

The purpose is to provide visibility and lightweight motivation, not to
create an opaque employee scoring system.

The leaderboard can show transparent metrics such as:

-   Tasks completed
-   Tasks completed on time
-   Active tasks
-   Overdue tasks
-   Completion rate
-   Current workload

The owner should be able to understand exactly how any displayed metric
is calculated.

Avoid creating an unexplained "employee score."

The product should not treat raw task count as a complete measure of
employee performance because tasks can differ greatly in size and
complexity.

The leaderboard should therefore be presented as a work-activity view
rather than a definitive employee-performance judgment.

------------------------------------------------------------------------

# 20. Analytics

Owner analytics should provide useful operational information.

Examples:

### Team Overview

-   Total tasks
-   Completed tasks
-   Active tasks
-   Overdue tasks
-   Blocked tasks

### Employee Workload

-   Assigned tasks
-   Active tasks
-   Completed tasks
-   Overdue tasks

### Project Progress

-   Total project tasks
-   Completed
-   In progress
-   Remaining

### Completion Trends

-   Tasks completed over time
-   Work volume over time

Analytics should prioritize information that helps an owner manage work
rather than generating unnecessary charts.

------------------------------------------------------------------------

# 21. Search and Filtering

The application should provide useful search.

Users should be able to find relevant tasks/projects quickly.

Search/filtering should support appropriate combinations such as:

-   Task title
-   Project
-   Employee
-   Status
-   Priority
-   Due date

Owner search should cover organization-wide data.

Employee search should respect their access permissions.

------------------------------------------------------------------------

# 22. Calendar

The existing prototype contains a Calendar section.

The calendar should provide a useful view of:

-   Task due dates
-   Upcoming work
-   Overdue tasks
-   Project deadlines

The calendar should remain task-focused rather than becoming a full
Google Calendar replacement.

------------------------------------------------------------------------

# 23. Activity / Audit History

Important changes should be traceable.

For example:

> Owner assigned "Amazon Upload" to Agnik.

> Agnik changed status from "To Do" to "In Progress."

> Agnik completed the task.

This gives the owner context when reviewing work.

------------------------------------------------------------------------

# 24. Permissions and Data Isolation

The system must maintain strict organization boundaries.

A user belonging to Workspace A must not be able to access private data
belonging to Workspace B.

Employees must not gain owner capabilities through UI manipulation or
direct API requests.

Resource ownership and role permissions should be respected throughout
the product.

------------------------------------------------------------------------

# 25. UX Requirements

The application should feel:

-   Modern
-   Clean
-   Professional
-   Fast
-   Simple
-   Business-oriented

The existing UI shown in the prototype can be used as the starting
visual direction.

Do not unnecessarily redesign the entire product if existing components
already work well.

Improve the product where the current structure does not support the new
organizational workflow.

The interface should work well for people who are not highly technical.

------------------------------------------------------------------------

# 26. Existing Prototype

The current prototype already contains concepts including:

-   Workspace
-   Projects
-   Tasks
-   Task status
-   Priority
-   Assignees
-   Calendar
-   Analytics
-   Settings
-   My Tasks
-   Basic CRUD functionality
-   PERN stack foundation

The existing application should be treated as the starting product
rather than a throwaway prototype.

Before major changes, the current application should be understood in
terms of:

-   Existing routes
-   Components
-   Database structure
-   API structure
-   Authentication state
-   Existing CRUD operations
-   Existing relationships
-   Existing UI patterns
-   Reusable functionality
-   Incomplete backend functionality

Preserve working functionality where it aligns with the new
requirements.

------------------------------------------------------------------------

# 27. Important Product Behavior Examples

### Example 1 --- Owner assigns work

Owner creates:

> Update Wishkaro product CSV

Assigned to:

> Employee A

Employee A sees it in My Tasks.

Employee B does not see it as their task.

Owner can see it in the organization task view.

------------------------------------------------------------------------

### Example 2 --- Employee creates personal work

Employee A creates:

> Check 100 product images

The system automatically associates the task with Employee A.

Employee A cannot assign it to Employee B.

Owner can see the task.

------------------------------------------------------------------------

### Example 3 --- Employee completes work

Employee A changes:

> In Progress → Completed

The system records the completion.

The owner dashboard reflects the completed task.

------------------------------------------------------------------------

### Example 4 --- Owner changes assignment

Owner changes:

> Employee A → Employee B

The assignment changes and the relevant activity is recorded.

------------------------------------------------------------------------

### Example 5 --- Overdue work

A task passes its due date without completion.

It becomes visibly overdue.

The employee sees it in their work view.

The owner sees it in the overdue work section.

------------------------------------------------------------------------

### Example 6 --- Multiple employees

A workspace contains 12 employees.

Each employee sees their own relevant work.

The owner sees organization-wide work.

Employees do not gain access to management functionality simply because
they belong to the workspace.

------------------------------------------------------------------------

# 28. Future-Ready Areas

The architecture/product should leave room for future features such as:

-   Departments
-   Teams
-   Team leads/managers
-   Recurring tasks
-   Task templates
-   File attachments
-   Employee announcements
-   Leave/availability information
-   Attendance integration
-   Email notifications
-   WhatsApp notifications
-   AI-generated daily summaries
-   AI task suggestions
-   Google Calendar integration
-   Reports/export
-   Mobile/PWA experience

These are future considerations, not requirements for the first version
unless they are already supported by the existing application.

------------------------------------------------------------------------

# 29. MVP Priority

The first usable version should prioritize:

### Critical

-   Authentication
-   Owner/Employee roles
-   Workspace
-   Employee joining/invitation
-   Task creation
-   Owner task assignment
-   Employee self-created tasks
-   Task ownership restrictions
-   Task status
-   Priority
-   Due dates
-   My Tasks
-   Owner dashboard
-   Team task view
-   Projects
-   Basic activity/history

### Important

-   Comments
-   Notifications
-   Calendar
-   Employee workload
-   Analytics
-   Leaderboard

### Later

-   Advanced reports
-   AI features
-   External integrations
-   Attendance
-   Leave management
-   Advanced team hierarchy

------------------------------------------------------------------------

# 30. Product Success Criteria

The product should make these questions easy to answer:

### For an employee

-   What do I need to do today?
-   What should I do first?
-   What is overdue?
-   What am I currently working on?
-   What have I completed?

### For the owner

-   What is everyone working on?
-   Who owns each task?
-   What is overdue?
-   What is blocked?
-   How much work is currently active?
-   Which projects need attention?
-   How much work has each employee completed?
-   What work was completed recently?
-   Where is the team workload concentrated?

The final product should reduce the need for the owner to ask employees
for basic work-status updates manually.
