import { resolveAiTaskInputs } from '../presentation/calendar/resolveAiTasks';
import { AiTaskInput } from '../types/schedule';
import { Task } from '../types/task';
import { createDefaultUserModel } from '../types/userModel';

// ts-jest hoists jest.mock() calls above the imports above, so these mocks
// are in place before resolveAiTasks (and its dependencies) are evaluated.
const mockEstimateBatch = jest.fn();
const mockUserModelGet = jest.fn();

jest.mock('../repositories', () => ({
  userModelRepository: {
    get: () => mockUserModelGet(),
  },
}));

jest.mock('../intelligence/taskEstimate/TaskDurationEstimator', () => ({
  taskDurationEstimator: {
    estimateBatch: (...args: unknown[]) => mockEstimateBatch(...args),
  },
}));

function makeFakeGateway() {
  let seq = 0;
  const createTask = jest.fn(async (input: {
    title: string;
    category?: string;
    estimatedMinutes: number;
    priority?: number;
    status?: string;
    splittable?: boolean;
  }): Promise<Task> => {
    seq += 1;
    return {
      id: `task-${seq}`,
      title: input.title,
      category: (input.category as Task['category']) ?? 'general',
      estimatedMinutes: input.estimatedMinutes,
      priority: (input.priority as Task['priority']) ?? 3,
      status: (input.status as Task['status']) ?? 'inbox',
      splittable: input.splittable ?? true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
  });
  const updateTask = jest.fn(async (task: Task): Promise<Task> => task);
  return { createTask, updateTask };
}

function makeExistingTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'existing-1',
    title: '勉強',
    category: 'study',
    estimatedMinutes: 90,
    priority: 3,
    status: 'inbox',
    splittable: true,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('resolveAiTaskInputs', () => {
  beforeEach(() => {
    mockEstimateBatch.mockReset();
    mockUserModelGet.mockReset();
    mockUserModelGet.mockResolvedValue(createDefaultUserModel());
  });

  it('uses the user-specified duration and does not call the estimator for it', async () => {
    const inputs: AiTaskInput[] = [{ title: '数学の課題', priority: 3, estimatedMinutes: 30 }];
    const gateway = makeFakeGateway();

    const { resolved } = await resolveAiTaskInputs(inputs, '2026-07-03', [], [], 30, gateway);

    expect(resolved).toHaveLength(1);
    expect(resolved[0].estimatedMinutes).toBe(30);
    expect(mockEstimateBatch).toHaveBeenCalledWith([]);
  });

  it('keeps a 45-minute user selection at 45 minutes even for a "study" keyword title', async () => {
    const inputs: AiTaskInput[] = [{ title: '勉強する', priority: 3, estimatedMinutes: 45 }];
    const gateway = makeFakeGateway();

    const { resolved } = await resolveAiTaskInputs(inputs, '2026-07-03', [], [], 30, gateway);

    expect(resolved[0].estimatedMinutes).toBe(45);
  });

  it('falls back to the estimator when no duration is specified', async () => {
    mockEstimateBatch.mockResolvedValue(
      new Map([['開発タスク', { estimatedMinutes: 90, category: 'work', source: 'local' }]])
    );
    const inputs: AiTaskInput[] = [{ title: '開発タスク', priority: 3 }];
    const gateway = makeFakeGateway();

    const { resolved } = await resolveAiTaskInputs(inputs, '2026-07-03', [], [], 30, gateway);

    expect(mockEstimateBatch).toHaveBeenCalledWith([{ title: '開発タスク', defaultMinutes: 30 }]);
    expect(resolved[0].estimatedMinutes).toBe(90);
  });

  it('only sends unspecified-duration tasks to the estimator when mixed with user-specified ones', async () => {
    mockEstimateBatch.mockResolvedValue(
      new Map([['買い物', { estimatedMinutes: 45, category: 'life', source: 'local' }]])
    );
    const inputs: AiTaskInput[] = [
      { title: '英単語', priority: 3, estimatedMinutes: 30 },
      { title: '買い物', priority: 3 },
    ];
    const gateway = makeFakeGateway();

    const { resolved } = await resolveAiTaskInputs(inputs, '2026-07-03', [], [], 30, gateway);

    expect(mockEstimateBatch).toHaveBeenCalledWith([{ title: '買い物', defaultMinutes: 30 }]);
    const byTitle = new Map(resolved.map((task) => [task.title, task]));
    expect(byTitle.get('英単語')?.estimatedMinutes).toBe(30);
    expect(byTitle.get('買い物')?.estimatedMinutes).toBe(45);
  });

  it('applies the existing estimationFactor scaling to a user-specified duration', async () => {
    mockUserModelGet.mockResolvedValue({
      ...createDefaultUserModel(),
      estimationFactor: { default: 1.5, general: 1.5 },
    });
    const inputs: AiTaskInput[] = [{ title: 'レポート', priority: 3, estimatedMinutes: 30 }];
    const gateway = makeFakeGateway();

    const { resolved } = await resolveAiTaskInputs(inputs, '2026-07-03', [], [], 30, gateway);

    expect(resolved[0].estimatedMinutes).toBe(45);
  });

  it('reuses a stale existing task unchanged when the new input has no duration', async () => {
    const existingTask = makeExistingTask({ estimatedMinutes: 90 });
    const inputs: AiTaskInput[] = [{ title: '勉強', priority: 3 }];
    const gateway = makeFakeGateway();

    const { resolved, reused } = await resolveAiTaskInputs(
      inputs,
      '2026-07-03',
      [existingTask],
      [],
      30,
      gateway
    );

    expect(reused).toBe(1);
    expect(resolved[0].estimatedMinutes).toBe(90);
    expect(gateway.updateTask).not.toHaveBeenCalled();
  });

  it('updates a stale existing task to a freshly re-specified duration instead of ignoring it', async () => {
    const existingTask = makeExistingTask({ estimatedMinutes: 90, splittable: true });
    const inputs: AiTaskInput[] = [{ title: '勉強', priority: 3, estimatedMinutes: 30 }];
    const gateway = makeFakeGateway();

    const { resolved, reused } = await resolveAiTaskInputs(
      inputs,
      '2026-07-03',
      [existingTask],
      [],
      30,
      gateway
    );

    expect(reused).toBe(1);
    expect(gateway.updateTask).toHaveBeenCalledTimes(1);
    expect(resolved[0].estimatedMinutes).toBe(30);
    expect(resolved[0].splittable).toBe(false);
    expect(gateway.createTask).not.toHaveBeenCalled();
  });

  it('does not call updateTask when the re-specified duration already matches the existing task', async () => {
    const existingTask = makeExistingTask({ estimatedMinutes: 30, splittable: false });
    const inputs: AiTaskInput[] = [{ title: '勉強', priority: 3, estimatedMinutes: 30 }];
    const gateway = makeFakeGateway();

    const { resolved } = await resolveAiTaskInputs(
      inputs,
      '2026-07-03',
      [existingTask],
      [],
      30,
      gateway
    );

    expect(gateway.updateTask).not.toHaveBeenCalled();
    expect(resolved[0]).toBe(existingTask);
  });
});
