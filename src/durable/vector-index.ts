/**
 * Vector Index Durable Object
 * Manages vector search and similarity operations
 */
export class VectorIndex {
  private vectors = new Map<string, number[]>();
  private metadata = new Map<string, any>();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    switch (pathname) {
      case '/index':
        return await this.handleIndex(method, request);
      case '/search':
        return await this.handleSearch(request);
      case '/stats':
        return this.handleStats();
      default:
        return new Response('Not Found', { status: 404 });
    }
  }

  private async handleIndex(method: string, request: Request): Promise<Response> {
    if (method === 'POST') {
      const data = await request.json();
      const { id, vector, metadata } = data;

      if (!id || !vector || !Array.isArray(vector)) {
        return Response.json({ error: 'Invalid request' }, { status: 400 });
      }

      this.vectors.set(id, vector);
      if (metadata) {
        this.metadata.set(id, metadata);
      }

      return Response.json({ success: true, id });
    } else if (method === 'GET') {
      return Response.json({
        vectors: Array.from(this.vectors.keys()),
        count: this.vectors.size
      });
    } else if (method === 'DELETE') {
      const id = new URL(request.url).searchParams.get('id');
      if (id) {
        this.vectors.delete(id);
        this.metadata.delete(id);
        return Response.json({ success: true, id });
      }
      return Response.json({ error: 'ID required' }, { status: 400 });
    }

    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  private async handleSearch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const query = url.searchParams.get('query');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    if (!query) {
      return Response.json({ error: 'Query vector required' }, { status: 400 });
    }

    try {
      const queryVector: number[] = JSON.parse(query);
      if (!Array.isArray(queryVector)) {
        return Response.json({ error: 'Invalid query vector' }, { status: 400 });
      }

      const results: Array<{ id: string; score: number }> = [];

      // Simple cosine similarity search
      for (const [id, vector] of this.vectors) {
        const similarity = this.cosineSimilarity(queryVector, vector);
        results.push({ id, score: similarity });
      }

      // Sort by score (descending) and limit results
      results.sort((a, b) => b.score - a.score);
      const topResults = results.slice(0, limit);

      // Add metadata to results
      const enrichedResults = topResults.map(result => ({
        ...result,
        metadata: this.metadata.get(result.id) || null
      }));

      return Response.json({ results: enrichedResults, query });
    } catch (error) {
      return Response.json({ error: 'Invalid query format' }, { status: 400 });
    }
  }

  private handleStats(): Response {
    return Response.json({
      totalVectors: this.vectors.size,
      totalMetadata: this.metadata.size,
      memoryUsage: {
        vectors: this.vectors.size * 100, // rough estimate
        metadata: this.metadata.size * 50   // rough estimate
      }
    });
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
  }
}