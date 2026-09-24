import { configureStore } from '@reduxjs/toolkit'
import workspaceReducer from '../features/workspaceSlice'
import themeReducer from '../features/themeSlice'
import notificationsReducer from '../features/notificationsSlice'

export const store = configureStore({
    reducer: {
        workspace: workspaceReducer,
        theme: themeReducer,
        notifications: notificationsReducer,
    },
})