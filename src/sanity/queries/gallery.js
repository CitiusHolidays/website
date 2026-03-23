/** Shared GROQ for gallery-backed pages (gallery + MICE use the same document type). */
export const GALLERY_DOCUMENT_QUERY = `*[_type == "gallery"][0]{
  images[]{
    asset->{
      _id,
      url
    },
    alt
  }
}`;
