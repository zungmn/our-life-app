import type { MetadataRoute } from 'next'

// 검색엔진 전체 차단 (프라이빗)
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', disallow: '/' },
  }
}
