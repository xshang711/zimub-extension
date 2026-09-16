import { TOTAL_HEIGHT_DEF, HEADER_HEIGHT, TOTAL_HEIGHT_MIN, TOTAL_HEIGHT_MAX, IFRAME_ID, STORAGE_ENV, DEFAULT_USE_PORT } from '@/consts/const'
import { AllExtensionMessages, AllInjectMessages, AllAPPMessages } from '@/message-typings'
import { InjectMessaging } from '../message'

const debug = (...args: any[]) => {
  console.debug('[Inject]', ...args)
}

(async function () {
  // 如果路径不是/video或/list，则不注入
  if (!location.pathname.startsWith('/video') && !location.pathname.startsWith('/list')) {
    debug('Not inject')
    return
  }

  // 读取envData
  const envDataStr = (await chrome.storage.sync.get(STORAGE_ENV))[STORAGE_ENV]
  let sidePanel: boolean | null = null
  let manualInsert: boolean | null = null
  if (envDataStr) {
    try {
      const envData = JSON.parse(envDataStr)
      debug('envData: ', envData)

      sidePanel = envData.sidePanel
      manualInsert = envData.manualInsert
    } catch (error) {
      console.error('Error parsing envData:', error)
    }
  }

  const runtime: {
    injectMessaging: InjectMessaging<AllExtensionMessages, AllInjectMessages, AllAPPMessages>
    fold: boolean
    videoElement?: HTMLVideoElement
    videoElementHeight: number
    showTrans: boolean
    curTrans?: string
  } = {
    injectMessaging: new InjectMessaging(DEFAULT_USE_PORT),
    fold: true,
    videoElementHeight: TOTAL_HEIGHT_DEF,
    showTrans: false,
  }

  const getVideoElement = () => {
    let video = document.querySelector('.bpx-player-video-wrap video') as HTMLVideoElement | null
    if (video) return video
    video = document.getElementById('bilibili-player')?.querySelector('video') as HTMLVideoElement | null
    if (video) return video
    video = document.querySelector('#bpx-player video, .bilibili-player-video video, .player-mobile-display video') as HTMLVideoElement | null
    if (video) return video
    const videos = Array.from(document.querySelectorAll('video'))
    if (videos.length > 0) {
      return videos.find(v => !v.paused) || videos[0]
    }
    return undefined
  }

  /**
   * @return if changed
   */
  const refreshVideoElement = () => {
    const newVideoElement = getVideoElement()
    const newVideoElementHeight = (newVideoElement != null) ? (Math.min(Math.max(newVideoElement.offsetHeight, TOTAL_HEIGHT_MIN), TOTAL_HEIGHT_MAX)) : TOTAL_HEIGHT_DEF
    if (newVideoElement === runtime.videoElement && Math.abs(newVideoElementHeight - runtime.videoElementHeight) < 1) {
      return false
    } else {
      runtime.videoElement = newVideoElement
      runtime.videoElementHeight = newVideoElementHeight
      updateIframeHeight()
      return true
    }
  }

  const createIframe = () => {
    if (document.getElementById(IFRAME_ID)) {
      return document.getElementById(IFRAME_ID) as HTMLIFrameElement
    }

    var danmukuBox = document.getElementById('danmukuBox')
    if (danmukuBox) {
      var vKey = ''
      for (const key in danmukuBox?.dataset) {
        if (key.startsWith('v-')) {
          vKey = key
          break
        }
      }

      const iframe = document.createElement('iframe')
      iframe.id = IFRAME_ID
      iframe.src = chrome.runtime.getURL('index.html')
      iframe.style.border = 'none'
      iframe.style.width = '100%'
      iframe.style.height = '44px'
      iframe.style.marginBottom = '3px'
      iframe.allow = 'clipboard-read; clipboard-write;'

      if (vKey) {
        iframe.dataset[vKey] = danmukuBox?.dataset[vKey]
      }

      // insert before first child
      danmukuBox?.insertBefore(iframe, danmukuBox?.firstChild)

      // show badge
      runtime.injectMessaging.sendExtension('SHOW_FLAG', {
        show: true
      })

      debug('Bilibili iframe inserted')

      return iframe
    }
  }

  if (!sidePanel && !manualInsert) {
    const timerIframe = setInterval(function () {
      var danmukuBox = document.getElementById('danmukuBox')
      if (danmukuBox) {
        clearInterval(timerIframe)
        setTimeout(createIframe, 1500)
      }
    }, 1000)
  }

  let aid: number | null = null
  let ctime: number | null = null
  let author: string | undefined
  let title = ''
  let pages: any[] = []
  let pagesMap: Record<string, any> = {}
  let ugcSeason: any = undefined

  let lastAidOrBvid: string | null = null
  let lastAid: number | null = null
  let lastCid: number | null = null

  const refreshVideoInfo = async (force: boolean = false) => {
    if (force) {
      lastAidOrBvid = null
      lastAid = null
      lastCid = null
    }
    if (!sidePanel) {
      const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | undefined
      if (!iframe) return
    }

    const pathSearchs: Record<string, string> = {}
    location.search.slice(1).replace(/([^=&]*)=([^=&]*)/g, (matchs, a, b, c) => pathSearchs[a] = b)

    // bvid
    let aidOrBvid = pathSearchs.bvid
    if (!aidOrBvid) {
      let path = location.pathname
      if (path.endsWith('/')) {
        path = path.slice(0, -1)
      }
      const paths = path.split('/')
      aidOrBvid = paths[paths.length - 1]
    }

    if (aidOrBvid && aidOrBvid !== lastAidOrBvid) {
      lastAidOrBvid = aidOrBvid
      let cid: number | undefined
      let chapters: any[] = []
      let subtitles: any[] = []

      if (aidOrBvid.toLowerCase().startsWith('av')) { // avxxx
        aid = parseInt(aidOrBvid.slice(2))
        try {
          const res = await fetch(`https://api.bilibili.com/x/player/pagelist?aid=${aid}`, { credentials: 'include' }).then(r => r.json())
          pages = res.data ?? []
          pagesMap = {}
          pages.forEach((page: any) => {
            pagesMap[page.page + ''] = page
          })

          const urlSearchParams = new URLSearchParams(window.location.search)
          const p = urlSearchParams.get('p') || '1'
          const currentPage = pagesMap[p] || pages[0]
          cid = currentPage?.cid
          ctime = pages[0]?.ctime
          author = pages[0]?.owner?.name
          title = currentPage?.part || pages[0]?.part || ''

          if (aid && cid) {
            const wbiRes = await fetch(`https://api.bilibili.com/x/player/wbi/v2?aid=${aid}&cid=${cid}`, { credentials: 'include' }).then(r => r.json())
            chapters = wbiRes.data?.view_points ?? []
            subtitles = (wbiRes.data?.subtitle?.subtitles ?? []).filter((item: any) => item.subtitle_url)
          }
        } catch (e) {
          console.error('[Inject] fetch av video info error:', e)
        }
      } else { // bvxxx
        try {
          const viewRes = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${aidOrBvid}`, { credentials: 'include' }).then(r => r.json())
          if (viewRes.code === 0 && viewRes.data) {
            title = viewRes.data.title
            aid = viewRes.data.aid
            ctime = viewRes.data.ctime
            author = viewRes.data.owner?.name
            pages = viewRes.data.pages ?? []
            ugcSeason = viewRes.data.ugc_season

            pagesMap = {}
            pages.forEach((page: any) => {
              pagesMap[page.page + ''] = page
            })

            const urlSearchParams = new URLSearchParams(window.location.search)
            const p = urlSearchParams.get('p') || '1'
            const currentPage = pagesMap[p] || pages[0]
            cid = currentPage?.cid ?? viewRes.data.cid

            if (aid && cid) {
              const wbiRes = await fetch(`https://api.bilibili.com/x/player/wbi/v2?aid=${aid}&cid=${cid}`, { credentials: 'include' }).then(r => r.json())
              chapters = wbiRes.data?.view_points ?? []
              subtitles = (wbiRes.data?.subtitle?.subtitles ?? []).filter((item: any) => item.subtitle_url)
            }
          }
        } catch (e) {
          console.error('[Inject] fetch bv video info error:', e)
        }
      }

      chapters = chapters.filter(chapter => chapter.type === 2)
      lastAid = aid
      lastCid = cid ?? null

      debug('refreshVideoInfo: ', aid, cid, pages, subtitles)

      runtime.injectMessaging.sendApp(!!sidePanel, 'SET_VIDEO_INFO', {
        url: location.origin + location.pathname,
        title,
        aid,
        bvid: aidOrBvid,
        cid: cid ?? null,
        ctime,
        author,
        pages,
        chapters,
        infos: subtitles,
        ugcSeason,
      })
    }
  }

  const refreshSubtitles = () => {
    if (!sidePanel) {
      const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | undefined
      if (!iframe) return
    }

    const urlSearchParams = new URLSearchParams(window.location.search)
    const p = urlSearchParams.get('p') || '1'
    const page = pagesMap[p]
    if (!page) return
    const cid: number | null = page.cid

    if (aid !== lastAid || cid !== lastCid) {
      debug('refreshSubtitles', aid, cid)

      lastAid = aid
      lastCid = cid
      if (aid && cid) {
        fetch(`https://api.bilibili.com/x/player/wbi/v2?aid=${aid}&cid=${cid}`, {
          credentials: 'include',
        })
          .then(async res => await res.json())
          .then(res => {
            const validSubtitles = (res.data?.subtitle?.subtitles ?? []).filter((item: any) => item.subtitle_url)
            runtime.injectMessaging.sendApp(!!sidePanel, 'SET_INFOS', {
              infos: validSubtitles
            })
          })
          .catch(console.error)
      }
    }
  }

  const updateIframeHeight = () => {
    const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | undefined
    if (iframe != null) {
      iframe.style.height = (runtime.fold ? HEADER_HEIGHT : runtime.videoElementHeight) + 'px'
    }
  }

  const methods: {
    [K in AllInjectMessages['method']]: (params: Extract<AllInjectMessages, { method: K }>['params'], context: MethodContext) => Promise<any>
  } = {
    TOGGLE_DISPLAY: async (params) => {
      const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | undefined
      if (iframe != null) {
        iframe.style.display = iframe.style.display === 'none' ? 'block' : 'none'
        runtime.injectMessaging.sendExtension('SHOW_FLAG', {
          show: iframe.style.display !== 'none'
        })
      } else {
        createIframe()
      }
    },
    FOLD: async (params) => {
      runtime.fold = params.fold
      updateIframeHeight()
    },
    MOVE: async (params) => {
      const video = getVideoElement()
      if (video != null) {
        video.currentTime = params.time
        if (params.togglePause) {
          video.paused ? video.play() : video.pause()
        }
      }
    },
    GET_SUBTITLE: async (params) => {
      let url = params.info.subtitle_url
      if (url.startsWith('//')) {
        url = 'https:' + url
      } else if (url.startsWith('http://')) {
        url = url.replace('http://', 'https://')
      }
      return await fetch(url).then(async res => await res.json())
    },
    GET_VIDEO_STATUS: async (params) => {
      const video = getVideoElement()
      if (video != null) {
        return {
          paused: video.paused,
          currentTime: video.currentTime
        }
      }
      return {
        paused: true,
        currentTime: 0
      }
    },
    GET_VIDEO_ELEMENT_INFO: async (params) => {
      refreshVideoElement()
      return {
        noVideo: runtime.videoElement == null,
        totalHeight: runtime.videoElementHeight,
      }
    },
    REFRESH_VIDEO_INFO: async (params) => {
      refreshVideoInfo(params.force)
    },
    GET_PART_SUBTITLE: async (params) => {
      const { aid, cid } = params
      if (!aid || !cid) return { subtitles: [], transcript: null }
      try {
        const res = await fetch(`https://api.bilibili.com/x/player/wbi/v2?aid=${aid}&cid=${cid}`, {
          credentials: 'include',
        }).then(r => r.json())
        const subtitles = (res.data?.subtitle?.subtitles ?? []).filter((item: any) => item.subtitle_url)
        if (!subtitles || subtitles.length === 0) {
          return { subtitles: [], transcript: null }
        }
        const chosen = subtitles[0]
        let url = chosen.subtitle_url
        if (url.startsWith('//')) {
          url = 'https:' + url
        } else if (url.startsWith('http://')) {
          url = url.replace('http://', 'https://')
        }
        const transcript = await fetch(url).then(r => r.json())
        return {
          subtitles,
          chosenSubtitle: chosen,
          transcript,
        }
      } catch (err: any) {
        console.error('[Inject] GET_PART_SUBTITLE error:', err)
        return { subtitles: [], transcript: null, error: err?.message }
      }
    },
    UPDATE_TRANS_RESULT: async (params) => {
      runtime.showTrans = true
      runtime.curTrans = params?.result

      let text = document.getElementById('trans-result-text')
      if (text) {
        text.innerHTML = runtime.curTrans ?? ''
      } else {
        const container = document.getElementsByClassName('bpx-player-subtitle-panel-wrap')?.[0]
        if (container) {
          const div = document.createElement('div')
          div.style.display = 'flex'
          div.style.justifyContent = 'center'
          div.style.margin = '2px'
          text = document.createElement('text')
          text.id = 'trans-result-text'
          text.innerHTML = runtime.curTrans ?? ''
          text.style.fontSize = '1rem'
          text.style.padding = '5px'
          text.style.color = 'white'
          text.style.background = 'rgba(0, 0, 0, 0.4)'
          div.append(text)

          container.append(div)
        }
      }
      text && (text.style.display = runtime.curTrans ? 'block' : 'none')
    },
    HIDE_TRANS: async (params) => {
      runtime.showTrans = false
      runtime.curTrans = undefined

      const text = document.getElementById('trans-result-text')
      if (text) {
        text.style.display = 'none'
      }
    },
    PLAY: async (params) => {
      const { play } = params
      const video = getVideoElement()
      if (video != null) {
        if (play) {
          await video.play()
        } else {
          video.pause()
        }
      }
    },
    DOWNLOAD_AUDIO: async (params) => {
      const html = document.getElementsByTagName('html')[0].innerHTML
      const playInfo = JSON.parse(html.match(/window.__playinfo__=(.+?)<\/script/)?.[1] ?? '{}')
      const audioUrl = playInfo.data.dash.audio[0].baseUrl

      fetch(audioUrl).then(async res => await res.blob()).then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${title}.m4s`
        a.click()
      })
    },
  }

  // 初始化injectMessage
  runtime.injectMessaging.init(methods)

  const checkVideoChange = () => {
    refreshVideoInfo().catch(console.error)
    refreshSubtitles()
  }

  window.addEventListener('popstate', checkVideoChange)

  const origPushState = history.pushState
  history.pushState = function (...args) {
    const ret = origPushState.apply(this, args)
    setTimeout(checkVideoChange, 150)
    return ret
  }

  const origReplaceState = history.replaceState
  history.replaceState = function (...args) {
    const ret = origReplaceState.apply(this, args)
    setTimeout(checkVideoChange, 150)
    return ret
  }

  setInterval(() => {
    if (!sidePanel) {
      const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | undefined
      if (!iframe || iframe.style.display === 'none') return
    }

    refreshVideoInfo().catch(console.error)
    refreshSubtitles()
  }, 1000)
})()
