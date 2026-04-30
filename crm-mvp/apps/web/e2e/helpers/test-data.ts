export function generateTestData() {
  const timestamp = Date.now();
  const now = new Date();
  const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dateTimeLocal = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return {
    lead: {
      name: `Lead Teste ${timestamp}`,
      email: `lead_${timestamp}@teste.com`,
      phone: `(11) 9${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(Math.random() * 9000 + 1000)}`,
      source: 'Website',
    },
    client: {
      name: `Cliente Teste ${timestamp}`,
      email: `cliente_${timestamp}@teste.com`,
      phone: `(11) 9${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(Math.random() * 9000 + 1000)}`,
      document: `${Math.floor(Math.random() * 900000000 + 100000000)}`,
    },
    schedule: {
      title: `Agendamento ${timestamp}`,
      clientName: `Cliente ${timestamp}`,
      dateTime: dateTimeLocal(future),
    },
    contract: {
      clientName: `Cliente ${timestamp}`,
      value: '5000',
      startDate: now.toISOString().split('T')[0],
      endDate: future.toISOString().split('T')[0],
    },
    reminder: {
      title: `Lembrete ${timestamp}`,
      clientName: `Cliente ${timestamp}`,
      dueDate: dateTimeLocal(future),
    },
  };
}

export function getFutureDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}
