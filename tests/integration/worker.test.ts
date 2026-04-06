// Mock the dependencies
jest.mock('@upstash/redis', () => {
  const mRedis = {
    rpop: jest.fn(),
    lpush: jest.fn()
  };
  return {
    Redis: jest.fn(() => mRedis)
  };
});
jest.mock('@/lib/notifications', () => ({
  dispatchNotification: jest.fn()
}));

const originalEnv = process.env;

describe('SMS Worker Integration Test', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.UPSTASH_REDIS_REST_URL = 'http://localhost';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
    process.env.CRON_SECRET = 'secret123';
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  it('should deny unauthorized requests', async () => {
    const { GET } = await import('@/app/api/workers/sms/route');
    const req = new Request('http://localhost:3000/api/workers/sms');
    (process.env as any).NODE_ENV = 'production';
    
    const response = await GET(req);
    expect(response.status).toBe(401);
  });

  it('should process queue items and call the notification dispatcher', async () => {
    const { GET } = require('@/app/api/workers/sms/route');
    const { dispatchNotification } = require('@/lib/notifications');
    const { Redis } = require('@upstash/redis');
    
    (process.env as any).NODE_ENV = 'development';
    const mockPayload = { to: '+919999999999', body: 'Test Warning', channel: 'SMS' };
    
    const redisMock = new Redis({ url: '', token: '' });
    (redisMock.rpop as jest.Mock)
       .mockResolvedValueOnce(JSON.stringify(mockPayload))
       .mockResolvedValueOnce(null);

    const req = new Request('http://localhost:3000/api/workers/sms', {
      headers: { authorization: `Bearer secret123` }
    });
    
    const response = await GET(req);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.processed).toBe(1);
    expect(dispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'Test Warning', to: '+919999999999' })
    );
  });
});
