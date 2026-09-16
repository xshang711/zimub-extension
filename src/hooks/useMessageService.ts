import {
  clearTransResults,
  setAid,
  setAuthor,
  setBvid,
  setChapters,
  setCid,
  setCtime,
  setCurFetched,
  setCurIdx,
  setCurInfo,
  setData,
  setInfos,
  setPages,
  setSegments,
  setTitle,
  setUgcSeason,
  setUrl,
} from '@/redux/envReducer'
import { useAppDispatch, useAppSelector } from './redux'
import { AllAPPMessages, AllExtensionMessages, AllInjectMessages } from '@/message-typings'
import { useMessaging, useMessagingService } from '../message'
import { useMemoizedFn } from 'ahooks'

const useMessageService = () => {
  const dispatch = useAppDispatch()
  const envData = useAppSelector((state) => state.env.envData)

  // methods
  const methodsFunc: () => {
    [K in AllAPPMessages['method']]: (params: Extract<AllAPPMessages, { method: K }>['params'], context: MethodContext) => Promise<any>
  } = useMemoizedFn(() => ({
    SET_INFOS: async (params: { infos: any }, context: MethodContext) => {
      dispatch(setInfos(params.infos ?? []))
      dispatch(setCurInfo(undefined))
      dispatch(setCurFetched(false))
      dispatch(setData(undefined))
      dispatch(setCurIdx(undefined))
      dispatch(setSegments(undefined))
      dispatch(clearTransResults())
    },
    SET_VIDEO_INFO: async (params: any, context: MethodContext) => {
      dispatch(setChapters(params.chapters))
      dispatch(setInfos(params.infos ?? []))
      dispatch(setUrl(params.url))
      dispatch(setTitle(params.title))
      dispatch(setCtime(params.ctime))
      dispatch(setAuthor(params.author))
      dispatch(setPages(params.pages))
      dispatch(setUgcSeason(params.ugcSeason))
      dispatch(setBvid(params.bvid))
      dispatch(setAid(params.aid))
      dispatch(setCid(params.cid))

      // Clean old subtitle states so new subtitles load properly
      dispatch(setCurInfo(undefined))
      dispatch(setCurFetched(false))
      dispatch(setData(undefined))
      dispatch(setCurIdx(undefined))
      dispatch(setSegments(undefined))
      dispatch(clearTransResults())
      console.debug('video title: ', params.title)
    },
  }))

  useMessagingService(!!envData.sidePanel, methodsFunc)
}

export default useMessageService
export const useMessage = useMessaging<AllExtensionMessages, AllInjectMessages>
