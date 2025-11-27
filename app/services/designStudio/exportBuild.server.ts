import type { Prisma } from '@prisma/client'
import { DesignBuildEventType } from '@prisma/client'
import { prisma } from '../../db.server'
import { loadDesignBuildDetail, DesignBuildActionError } from '../../lib/designStudio/builds.server'
import type { DesignBuildDetail } from '../../lib/designStudio/types'
import { parseDesignBuildComponentSummary } from '../../lib/designStudio/summary'
import { uploadObjectToS3 } from '../storage/s3.server'

export type ExportDesignBuildArgs = {
  buildId: string
  shopDomain: string
  performedBy?: string | null
}

export type ExportDesignBuildResult = {
  detail: DesignBuildDetail
  exportMeta: {
    url: string
    key: string
    exportedAt: string
    bytes: number
  }
}

const DEFAULT_PREFIX = 'builds'

export async function exportDesignBuildPacket({
  buildId,
  shopDomain,
  performedBy,
}: ExportDesignBuildArgs): Promise<ExportDesignBuildResult> {
  const detail = await loadDesignBuildDetail(buildId)
  if (!detail) {
    throw new DesignBuildActionError('Build not found', 'NOT_FOUND')
  }
  if (detail.build.shopDomain !== shopDomain) {
    throw new DesignBuildActionError('Forbidden', 'FORBIDDEN')
  }
  const bucket = process.env.DESIGN_STUDIO_EXPORT_BUCKET
  if (!bucket) {
    throw new DesignBuildActionError('Design Studio export bucket is not configured', 'UNKNOWN')
  }
  const prefix = sanitizePrefix(process.env.DESIGN_STUDIO_EXPORT_PREFIX) || DEFAULT_PREFIX
  const key = `${prefix}/${shopDomain}/${detail.build.id}.json`
  const exportedAt = new Date().toISOString()
  const packet = buildExportPacket(detail, exportedAt)
  const json = JSON.stringify(packet, null, 2)
  const upload = await uploadObjectToS3({
    bucket,
    key,
    body: json,
    contentType: 'application/json',
    publicBaseUrl: process.env.DESIGN_STUDIO_EXPORT_BASE_URL,
  })

  await prisma.designBuildEvent.create({
    data: {
      buildId,
      eventType: DesignBuildEventType.EXPORT,
      payload: {
        url: upload.url,
        key: upload.key,
        bytes: upload.bytes,
        exportedAt,
        contentType: 'application/json',
      },
      performedBy: performedBy ? performedBy.slice(0, 120) : null,
    },
  })

  const refreshed = await loadDesignBuildDetail(buildId)
  if (!refreshed) {
    throw new DesignBuildActionError('Build not found after export', 'NOT_FOUND')
  }
  return {
    detail: refreshed,
    exportMeta: {
      url: upload.url,
      key: upload.key,
      exportedAt,
      bytes: upload.bytes,
    },
  }
}

function buildExportPacket(detail: DesignBuildDetail, exportedAt: string) {
  const { componentSummary, notesJson, ...rest } = detail.build
  const bom = parseDesignBuildComponentSummary(componentSummary)
  return {
    version: 'design-build-export/v1',
    exportedAt,
    build: {
      ...rest,
      componentSummary: componentSummary as Prisma.JsonValue,
      notesJson: notesJson as Prisma.JsonValue,
    },
    billOfMaterials: bom,
    notes: notesJson,
    events: detail.events,
  }
}

function sanitizePrefix(value: string | undefined): string {
  if (!value) return ''
  return value.replace(/^\/+/, '').replace(/\/+$/, '')
}
