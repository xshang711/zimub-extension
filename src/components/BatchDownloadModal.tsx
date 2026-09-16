import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppSelector } from '../hooks/redux'
import { useMessage } from '../hooks/useMessageService'
import { downloadBlob, downloadText, formatTime } from '../utils/util'
import { ExportFormat, formatTranscript } from '../utils/subtitleExport'
import toast from 'react-hot-toast'
import JSZip from 'jszip'
import classNames from 'classnames'
import {
  AiOutlineCheck,
  AiOutlineClose,
  AiOutlineLoading3Quarters,
  AiOutlineWarning,
} from 'react-icons/ai'
import { ImDownload3 } from 'react-icons/im'

interface EpisodeItem {
  id: string | number
  index: number
  aid: number
  cid: number
  bvid?: string
  title: string
  duration?: number
}

type ItemStatus = 'idle' | 'fetching' | 'success' | 'no_subtitle' | 'error'

const sanitizeFilename = (name: string) => {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim()
}

export const BatchDownloadModal = (props: {
  visible: boolean
  onClose: () => void
}) => {
  const { visible, onClose } = props
  const envData = useAppSelector(state => state.env.envData)
  const currentAid = useAppSelector(state => state.env.aid)
  const currentBvid = useAppSelector(state => state.env.bvid)
  const currentTitle = useAppSelector(state => state.env.title)
  const pages = useAppSelector(state => state.env.pages)
  const ugcSeason = useAppSelector(state => state.env.ugcSeason)

  const { sendInject } = useMessage(!!envData.sidePanel)

  // Collection tabs: 'pages' (分P) or 'season' (合集)
  const [activeTab, setActiveTab] = useState<'pages' | 'season'>('pages')
  const [format, setFormat] = useState<ExportFormat>('md')
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})
  const [statuses, setStatuses] = useState<Record<string, { status: ItemStatus; msg?: string }>>({})
  const [isDownloading, setIsDownloading] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 })

  // Build list of episodes for 分P (pages)
  const pageEpisodes = useMemo<EpisodeItem[]>(() => {
    if (!pages || !pages.length || !currentAid) return []
    return pages.map((p: any, idx: number) => ({
      id: `p_${p.cid}`,
      index: idx + 1,
      aid: currentAid,
      cid: p.cid,
      bvid: currentBvid,
      title: p.part || `P${idx + 1}`,
      duration: p.duration,
    }))
  }, [pages, currentAid, currentBvid])

  // Build list of episodes for 合集 (ugcSeason)
  const seasonEpisodes = useMemo<EpisodeItem[]>(() => {
    if (!ugcSeason?.sections?.length) return []
    const list: EpisodeItem[] = []
    let globalIdx = 1
    for (const section of ugcSeason.sections) {
      for (const ep of section.episodes ?? []) {
        list.push({
          id: `season_${ep.id || ep.cid}`,
          index: globalIdx++,
          aid: ep.aid,
          cid: ep.cid,
          bvid: ep.bvid,
          title: ep.title || ep.arc?.title || ep.page?.part || `第${globalIdx}集`,
          duration: ep.arc?.duration || ep.page?.duration,
        })
      }
    }
    return list
  }, [ugcSeason])

  // Default active tab
  useEffect(() => {
    if (ugcSeason?.sections?.length && (!pages || pages.length <= 1)) {
      setActiveTab('season')
    } else {
      setActiveTab('pages')
    }
  }, [ugcSeason, pages])

  const currentEpisodes = useMemo(() => {
    return activeTab === 'season' ? seasonEpisodes : pageEpisodes
  }, [activeTab, seasonEpisodes, pageEpisodes])

  // Select all episodes by default when tab changes or opens
  useEffect(() => {
    if (visible) {
      const initSelected: Record<string, boolean> = {}
      currentEpisodes.forEach(ep => {
        initSelected[String(ep.id)] = true
      })
      setSelectedIds(initSelected)
      setStatuses({})
      setIsDownloading(false)
    }
  }, [visible, currentEpisodes])

  const selectedCount = useMemo(() => {
    return currentEpisodes.filter(ep => selectedIds[String(ep.id)]).length
  }, [currentEpisodes, selectedIds])

  const isAllSelected = useMemo(() => {
    return currentEpisodes.length > 0 && selectedCount === currentEpisodes.length
  }, [currentEpisodes, selectedCount])

  const toggleSelectAll = useCallback(() => {
    const nextVal = !isAllSelected
    const nextSelected: Record<string, boolean> = {}
    currentEpisodes.forEach(ep => {
      nextSelected[String(ep.id)] = nextVal
    })
    setSelectedIds(nextSelected)
  }, [isAllSelected, currentEpisodes])

  const toggleSelect = useCallback((id: string | number) => {
    setSelectedIds(prev => ({
      ...prev,
      [String(id)]: !prev[String(id)],
    }))
  }, [])

  // Execute batch download as ZIP
  const handleDownloadZip = useCallback(async () => {
    const targets = currentEpisodes.filter(ep => selectedIds[String(ep.id)])
    if (targets.length === 0) {
      toast.error('请至少选择一个视频！')
      return
    }

    setIsDownloading(true)
    setProgress({ current: 0, total: targets.length })

    const zip = new JSZip()
    let successCount = 0
    let noSubtitleCount = 0

    for (let i = 0; i < targets.length; i++) {
      const ep = targets[i]
      const epKey = String(ep.id)
      setProgress({ current: i + 1, total: targets.length })
      setStatuses(prev => ({ ...prev, [epKey]: { status: 'fetching' } }))

      try {
        const res = await sendInject(null, 'GET_PART_SUBTITLE', {
          aid: ep.aid,
          cid: ep.cid,
          bvid: ep.bvid,
        })

        if (res?.transcript?.body?.length > 0) {
          const { content, extension } = formatTranscript(format, res.transcript.body, ep.title)
          const paddedIndex = String(ep.index).padStart(2, '0')
          const fileName = `${paddedIndex}_${sanitizeFilename(ep.title)}.${extension}`
          zip.file(fileName, content)

          setStatuses(prev => ({ ...prev, [epKey]: { status: 'success' } }))
          successCount++
        } else {
          setStatuses(prev => ({ ...prev, [epKey]: { status: 'no_subtitle', msg: '无字幕' } }))
          noSubtitleCount++
        }
      } catch (err: any) {
        console.error(`Failed to fetch subtitle for ${ep.title}:`, err)
        setStatuses(prev => ({ ...prev, [epKey]: { status: 'error', msg: '获取失败' } }))
      }

      // Small delay to prevent rate-limit
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    setIsDownloading(false)

    if (successCount === 0) {
      toast.error('选中的视频均无字幕可下载！')
      return
    }

    try {
      toast.loading('正在打包生成 ZIP 文件...', { id: 'zip-toast' })
      const blob = await zip.generateAsync({ type: 'blob' })
      const collectionName = activeTab === 'season'
        ? (ugcSeason?.title || currentTitle || '合集')
        : (currentTitle || '分P合集')
      downloadBlob(blob, `${sanitizeFilename(collectionName)}_字幕合集.zip`)
      toast.success(`成功打包 ${successCount} 集字幕！${noSubtitleCount ? `(${noSubtitleCount}集无字幕)` : ''}`, { id: 'zip-toast' })
    } catch (err: any) {
      console.error('ZIP generation failed:', err)
      toast.error('生成压缩包失败，请重试', { id: 'zip-toast' })
    }
  }, [activeTab, currentEpisodes, currentTitle, format, selectedIds, sendInject, ugcSeason?.title])

  // Merge all into one single TXT
  const handleDownloadMerged = useCallback(async () => {
    const targets = currentEpisodes.filter(ep => selectedIds[String(ep.id)])
    if (targets.length === 0) {
      toast.error('请至少选择一个视频！')
      return
    }

    setIsDownloading(true)
    setProgress({ current: 0, total: targets.length })

    let mergedText = ''
    let successCount = 0

    for (let i = 0; i < targets.length; i++) {
      const ep = targets[i]
      const epKey = String(ep.id)
      setProgress({ current: i + 1, total: targets.length })
      setStatuses(prev => ({ ...prev, [epKey]: { status: 'fetching' } }))

      try {
        const res = await sendInject(null, 'GET_PART_SUBTITLE', {
          aid: ep.aid,
          cid: ep.cid,
          bvid: ep.bvid,
        })

        if (res?.transcript?.body?.length > 0) {
          const { content } = formatTranscript(format, res.transcript.body, ep.title)
          mergedText += `========================================\n`
          mergedText += `第 ${ep.index} 集：${ep.title}\n`
          mergedText += `========================================\n\n`
          mergedText += content + '\n\n'

          setStatuses(prev => ({ ...prev, [epKey]: { status: 'success' } }))
          successCount++
        } else {
          setStatuses(prev => ({ ...prev, [epKey]: { status: 'no_subtitle', msg: '无字幕' } }))
        }
      } catch (err: any) {
        setStatuses(prev => ({ ...prev, [epKey]: { status: 'error', msg: '获取失败' } }))
      }

      await new Promise(resolve => setTimeout(resolve, 100))
    }

    setIsDownloading(false)

    if (successCount === 0) {
      toast.error('选中的视频均无字幕可合并！')
      return
    }

    const collectionName = activeTab === 'season'
      ? (ugcSeason?.title || currentTitle || '合集')
      : (currentTitle || '分P合集')
    const ext = format === 'md' ? 'md' : 'txt'
    downloadText(mergedText, `${sanitizeFilename(collectionName)}_完整合并字幕.${ext}`)
    toast.success(`成功合并导出 ${successCount} 集字幕！`)
  }, [activeTab, currentEpisodes, currentTitle, format, selectedIds, sendInject, ugcSeason?.title])

  if (!visible) return null

  return (
    <div
      className='fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 p-2 animate-fade-in'
      onClick={e => {
        e.stopPropagation()
        if (!isDownloading) onClose()
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div
        className='bg-base-100 text-base-content rounded-lg shadow-2xl w-full max-w-lg flex flex-col max-h-[96%] overflow-hidden border border-base-300'
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className='flex items-center justify-between px-4 py-3 border-b border-base-200 bg-base-200/50'>
          <div className='flex items-center gap-2'>
            <ImDownload3 className='text-primary text-lg' />
            <h3 className='font-bold text-base'>批量下载合集字幕</h3>
          </div>
          <button
            className='btn btn-ghost btn-xs btn-circle'
            onClick={e => {
              e.stopPropagation()
              onClose()
            }}
            disabled={isDownloading}
          >
            <AiOutlineClose className='text-base' />
          </button>
        </div>

        {/* Tab switcher if both 分P and 合集 exist */}
        {seasonEpisodes.length > 0 && pageEpisodes.length > 1 && (
          <div className='tabs tabs-boxed bg-base-200/50 mx-4 mt-3'>
            <a
              className={classNames('tab tab-sm flex-1', activeTab === 'pages' && 'tab-active')}
              onClick={e => {
                e.stopPropagation()
                if (!isDownloading) setActiveTab('pages')
              }}
            >
              分P视频 ({pageEpisodes.length}集)
            </a>
            <a
              className={classNames('tab tab-sm flex-1', activeTab === 'season' && 'tab-active')}
              onClick={e => {
                e.stopPropagation()
                if (!isDownloading) setActiveTab('season')
              }}
            >
              UP主合集 ({seasonEpisodes.length}集)
            </a>
          </div>
        )}

        {/* Configuration Bar */}
        <div className='flex items-center justify-between px-4 py-2 text-xs bg-base-200/20 border-b border-base-200 gap-2 flex-wrap'>
          <label className='flex items-center gap-1.5 cursor-pointer select-none' onClick={e => e.stopPropagation()}>
            <input
              type='checkbox'
              className='checkbox checkbox-primary checkbox-xs'
              checked={isAllSelected}
              onChange={toggleSelectAll}
              disabled={isDownloading}
            />
            <span className='font-medium'>
              全选 (已选 {selectedCount}/{currentEpisodes.length})
            </span>
          </label>

          <div className='flex items-center gap-1.5' onClick={e => e.stopPropagation()}>
            <span className='desc'>导出格式:</span>
            <select
              className='select select-bordered select-xs'
              value={format}
              onChange={e => setFormat(e.target.value as ExportFormat)}
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              disabled={isDownloading}
            >
              <option value='md'>Markdown (.md - 默认推荐)</option>
              <option value='srt'>SRT (.srt)</option>
              <option value='vtt'>VTT (.vtt)</option>
              <option value='textWithTime'>TXT (时间+字幕)</option>
              <option value='text'>TXT (纯文本)</option>
              <option value='json'>JSON (.json)</option>
            </select>
          </div>
        </div>

        {/* Episode List */}
        <div className='flex-1 overflow-y-auto px-4 py-2 space-y-1.5 divide-y divide-base-200/50 min-h-[220px] max-h-[360px]'>
          {currentEpisodes.length === 0 ? (
            <div className='text-center py-8 desc flex flex-col items-center gap-2'>
              <AiOutlineWarning className='text-2xl text-warning' />
              <span>当前视频未检测到分P或合集列表</span>
            </div>
          ) : (
            currentEpisodes.map(ep => {
              const epKey = String(ep.id)
              const isChecked = !!selectedIds[epKey]
              const statusInfo = statuses[epKey]

              return (
                <div
                  key={epKey}
                  className={classNames(
                    'flex items-center justify-between py-1.5 px-2 rounded cursor-pointer transition-colors text-xs',
                    isChecked ? 'bg-base-200/40 hover:bg-base-200/70' : 'hover:bg-base-200/20 opacity-70'
                  )}
                  onClick={() => !isDownloading && toggleSelect(ep.id)}
                >
                  <div className='flex items-center gap-2 overflow-hidden flex-1 mr-2'>
                    <input
                      type='checkbox'
                      className='checkbox checkbox-primary checkbox-xs'
                      checked={isChecked}
                      onChange={() => {}}
                      disabled={isDownloading}
                    />
                    <span className='badge badge-ghost badge-xs font-mono shrink-0'>
                      P{ep.index}
                    </span>
                    <span className='truncate font-medium' title={ep.title}>
                      {ep.title}
                    </span>
                  </div>

                  <div className='flex items-center gap-2 shrink-0'>
                    {ep.duration != null && ep.duration > 0 && (
                      <span className='desc font-mono'>{formatTime(ep.duration)}</span>
                    )}

                    {statusInfo?.status === 'fetching' && (
                      <span className='badge badge-info badge-xs gap-1'>
                        <AiOutlineLoading3Quarters className='animate-spin' /> 获取中
                      </span>
                    )}
                    {statusInfo?.status === 'success' && (
                      <span className='badge badge-success badge-xs gap-1'>
                        <AiOutlineCheck /> 完成
                      </span>
                    )}
                    {statusInfo?.status === 'no_subtitle' && (
                      <span className='badge badge-warning badge-xs'>
                        {statusInfo.msg || '无字幕'}
                      </span>
                    )}
                    {statusInfo?.status === 'error' && (
                      <span className='badge badge-error badge-xs'>
                        {statusInfo.msg || '失败'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Progress Bar (during downloading) */}
        {isDownloading && (
          <div className='px-4 py-2 bg-primary/10 border-t border-primary/20 flex flex-col gap-1'>
            <div className='flex justify-between text-xs text-primary font-medium'>
              <span>正在批量下载并解析字幕...</span>
              <span>
                {progress.current} / {progress.total}
              </span>
            </div>
            <progress
              className='progress progress-primary w-full h-1.5'
              value={progress.current}
              max={progress.total}
            />
          </div>
        )}

        {/* Footer actions */}
        <div className='flex items-center justify-between px-4 py-3 border-t border-base-200 bg-base-200/30'>
          <button
            className='btn btn-ghost btn-xs text-xs'
            onClick={handleDownloadMerged}
            disabled={isDownloading || selectedCount === 0}
            title='将选中的所有字幕合并为一个txt文件导出'
          >
            合并导出为单个TXT
          </button>

          <div className='flex items-center gap-2'>
            <button
              className='btn btn-ghost btn-xs'
              onClick={onClose}
              disabled={isDownloading}
            >
              取消
            </button>
            <button
              className='btn btn-primary btn-xs gap-1.5'
              onClick={handleDownloadZip}
              disabled={isDownloading || selectedCount === 0}
            >
              {isDownloading ? (
                <>
                  <AiOutlineLoading3Quarters className='animate-spin' />
                  打包中...
                </>
              ) : (
                <>
                  <ImDownload3 />
                  打包下载 ZIP ({selectedCount})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BatchDownloadModal
