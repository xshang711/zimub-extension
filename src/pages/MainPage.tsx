import React, {useCallback, useContext, useEffect} from 'react'
import {useAppDispatch, useAppSelector} from '../hooks/redux'
import Header from '../components/Header'
import Body from '../components/Body'
import useSubtitleService from '../hooks/useSubtitleService'
import {EVENT_EXPAND} from '../consts/const'
import {EventBusContext} from '../Router'
import useTranslateService from '../hooks/useTranslateService'
import {setTheme} from '../utils/bizUtil'
import useSearchService from '../hooks/useSearchService'
import {setBatchModalVisible, setFold} from '../redux/envReducer'
import { useMessage } from '@/hooks/useMessageService'
import BatchDownloadModal from '../components/BatchDownloadModal'

function App() {
  const dispatch = useAppDispatch()
  const fold = useAppSelector(state => state.env.fold)
  const envData = useAppSelector(state => state.env.envData)
  const eventBus = useContext(EventBusContext)
  const totalHeight = useAppSelector(state => state.env.totalHeight)
  const batchModalVisible = useAppSelector(state => state.env.batchModalVisible)
  const {sendInject} = useMessage(!!envData.sidePanel)

  const foldCallback = useCallback(() => {
    dispatch(setFold(!fold))
    sendInject(null, 'FOLD', {fold: !fold})
  }, [dispatch, fold, sendInject])

  // handle event
  eventBus.useSubscription((event: any) => {
    if (event.type === EVENT_EXPAND) {
      if (fold) {
        foldCallback()
      }
    }
  })

  // 当打开批量下载时，确保展开面板
  useEffect(() => {
    if (batchModalVisible && fold) {
      foldCallback()
    }
  }, [batchModalVisible, fold, foldCallback])

  // theme改变时，设置主题
  useEffect(() => {
    setTheme(envData.theme)
  }, [envData.theme])

  useSubtitleService()
  useTranslateService()
  useSearchService()

  return <div className='select-none w-full relative bg-base-100 text-base-content transition-colors duration-200' style={{
    height: fold?undefined:`${totalHeight}px`,
  }}>
    <Header foldCallback={foldCallback}/>
    {!fold && <Body/>}
    <BatchDownloadModal
      visible={batchModalVisible}
      onClose={() => dispatch(setBatchModalVisible(false))}
    />
  </div>
}

export default App
