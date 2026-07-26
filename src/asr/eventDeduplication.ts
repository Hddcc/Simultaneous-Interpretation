export class RealtimeAsrEventDeduplicator {
  private readonly ids = new Set<string>();

  constructor(private readonly limit = 512) {}

  filter<T extends { id: string }>(events: T[]): T[] {
    const unique: T[] = [];

    events.forEach((event) => {
      if (this.ids.has(event.id)) {
        return;
      }
      this.ids.add(event.id);
      unique.push(event);
    });

    while (this.ids.size > this.limit) {
      const oldestId = this.ids.values().next().value as string | undefined;
      if (!oldestId) {
        break;
      }
      this.ids.delete(oldestId);
    }

    return unique;
  }

  reset(): void {
    this.ids.clear();
  }
}
