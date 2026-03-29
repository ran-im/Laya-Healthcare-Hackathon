export function createMockStorage() {
  return {
    from(bucket: string) {
      return {
        async upload(path: string, _file: unknown) {
          return { data: { path: `${bucket}/${path}` }, error: null }
        },
        getPublicUrl(path: string) {
          return { data: { publicUrl: `/mock-uploads/${bucket}/${path}` } }
        },
        async createSignedUrl(path: string, _expiresIn: number) {
          return {
            data: { signedUrl: `/mock-uploads/${bucket}/${path}?token=mock` },
            error: null,
          }
        },
      }
    },
  }
}
