# Changelog

Bu projedeki tüm önemli değişiklikler bu dosyada belgelenir.

Format [Keep a Changelog](https://keepachangelog.com/tr/1.0.0/) yapısına yakındır ve proje
[Semantic Versioning](https://semver.org/lang/tr/) kullanır.

## [Unreleased]

## [0.1.0] - 2026-07-28

### Added

- Ortak Alan modülü için Word ve Excel doküman türleri (`dt_word`, `dt_excel`) sistem kaydı olarak tanımlandı.

### Fixed

- Eksik doküman türü (document type) kayıtları, seed akışına eklenen idempotent script ile her ortamda garanti altına alındı.
- Dosya yükleme middleware'inin varsayılan 10 MB gövde sınırı, uygulamanın 25 MB'lık dosya yükleme desteğini engelliyordu; sınır düzeltilerek 25 MB'lık yükleme desteği devreye alındı.

### Infrastructure

- Next.js, Prisma, PostgreSQL, Docker Compose ve Coolify tabanlı production dağıtım yapısı kuruldu.
- Docker Compose deploy akışına `prisma migrate deploy` adımı eklendi.
