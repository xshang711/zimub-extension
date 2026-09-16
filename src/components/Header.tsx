import { IoIosArrowUp } from 'react-icons/io'
import { RiSunLine, RiMoonLine, RiLeafLine } from 'react-icons/ri'
import {useCallback} from 'react'
import {useAppDispatch, useAppSelector} from '../hooks/redux'
import {find, remove} from 'lodash-es'
import {setCurFetched, setCurInfo, setData, setEnvData, setInfos, setUploadedTranscript} from '../redux/envReducer'
import MoreBtn from './MoreBtn'
import classNames from 'classnames'
import {parseTranscript} from '../utils/bizUtil'
import {isDarkMode} from '../utils/env_util'

const Header = (props: {
  foldCallback: () => void
}) => {
  const {foldCallback} = props
  const dispatch = useAppDispatch()
  const infos = useAppSelector(state => state.env.infos)
  const curInfo = useAppSelector(state => state.env.curInfo)
  const fold = useAppSelector(state => state.env.fold)
  const uploadedTranscript = useAppSelector(state => state.env.uploadedTranscript)
  const envData = useAppSelector(state => state.env.envData)

  const upload = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.vtt,.srt'
    input.onchange = (e: any) => {
      const file = e.target.files[0]
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result
        if (text) {
          const infos_ = [...(infos??[])]
          // const blob = new Blob([text], {type: 'text/plain'})
          // const url = URL.createObjectURL(blob)
          // remove old if exist
          remove(infos_, {id: 'uploaded'})
          // add new
          const tarInfo = {id: 'uploaded', subtitle_url: 'uploaded', lan_doc: '上传的字幕'}
          infos_.push(tarInfo)
          // set
          const transcript = parseTranscript(file.name, text)
          dispatch(setInfos(infos_))
          dispatch(setCurInfo(tarInfo))
          dispatch(setCurFetched(true))
          dispatch(setUploadedTranscript(transcript))
          dispatch(setData(transcript))
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }, [dispatch, infos])

  const selectCallback = useCallback((e: any) => {
    if (e.target.value === 'upload') {
      upload()
      return
    }

    const tarInfo = find(infos, {subtitle_url: e.target.value})
    if (curInfo?.id !== tarInfo?.id) {
      dispatch(setCurInfo(tarInfo))
      if (tarInfo && tarInfo.subtitle_url === 'uploaded') {
        dispatch(setCurFetched(true))
        dispatch(setData(uploadedTranscript))
      } else {
        dispatch(setCurFetched(false))
      }
    }
  }, [curInfo?.id, dispatch, infos, upload, uploadedTranscript])

  const preventCallback = useCallback((e: any) => {
    e.stopPropagation()
  }, [])

  const onUpload = useCallback((e: any) => {
    e.stopPropagation()
    upload()
  }, [upload])

  const currentTheme = envData.theme ?? 'system'
  const effectiveTheme = (currentTheme === 'system' || !currentTheme)
    ? (isDarkMode() ? 'dark' : 'light')
    : currentTheme

  const cycleTheme = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    let nextTheme: 'light' | 'dark' | 'eyecare' = 'dark'
    if (effectiveTheme === 'light') {
      nextTheme = 'dark'
    } else if (effectiveTheme === 'dark') {
      nextTheme = 'eyecare'
    } else {
      nextTheme = 'light'
    }
    dispatch(setEnvData({
      ...envData,
      theme: nextTheme,
    }))
  }, [dispatch, effectiveTheme, envData])

  return <div className='rounded-[6px] bg-base-200 border border-base-300/40 h-[44px] flex justify-between items-center select-none'>
    <div className='shrink-0 flex items-center'>
      {/* <img src="bibijun.png" alt="Logo" className="w-auto h-6 ml-2 mr-1" /> */}
      <span className='shrink-0 text-[15px] font-medium pl-[16px] pr-[14px] select-none'>字幕列表</span>
      <MoreBtn placement={'right-start'}/>
    </div>
    <div className='flex gap-1 items-center mr-[14px]'>
      {(infos == null) || infos.length <= 0
        ?<div className='text-xs desc'>
          <button className='btn btn-xs btn-link' onClick={onUpload}>上传(vtt/srt)</button>
          (未找到字幕)
      </div>
        :<select disabled={!infos || infos.length <= 0} className='select select-ghost select-xs line-clamp-1' value={curInfo?.subtitle_url} onChange={selectCallback} onClick={preventCallback}>
          {infos?.map((item: any) => <option key={item.id} value={item.subtitle_url}>{item.lan_doc}</option>)}
          <option key='upload' value='upload'>上传(vtt/srt)</option>
        </select>}
      {/* 快捷主题切换：浅色 ➔ 暗夜 ➔ 护眼 */}
      <div
        className='cursor-pointer p-1 rounded hover:bg-base-300/60 flex items-center justify-center transition-colors'
        onClick={cycleTheme}
        title={
          effectiveTheme === 'light'
            ? '当前：浅色白天（点击切换为暗夜模式）'
            : effectiveTheme === 'dark'
            ? '当前：深色暗夜（点击切换为护眼模式）'
            : '当前：护眼暖光（点击切换为浅色模式）'
        }
      >
        {effectiveTheme === 'light' && <RiSunLine className='shrink-0 text-[16px] text-amber-500' />}
        {effectiveTheme === 'dark' && <RiMoonLine className='shrink-0 text-[16px] text-sky-400' />}
        {effectiveTheme === 'eyecare' && <RiLeafLine className='shrink-0 text-[16px] text-emerald-600' />}
      </div>
      {!envData.sidePanel && (
        <div
          className='cursor-pointer p-1 rounded hover:bg-base-300/60 flex items-center justify-center transition-colors'
          onClick={(e) => {
            e.stopPropagation()
            foldCallback()
          }}
          title={fold ? '展开字幕' : '收起字幕'}
        >
          <IoIosArrowUp className={classNames('shrink-0 desc transform ease-in duration-300', fold ? 'rotate-180' : '')} />
        </div>
      )}
    </div>
  </div>
}

export default Header
