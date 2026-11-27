// Спільний стан вигляду карти (issue #64): центр і масштаб. Шари (MapView, Overlay, ZoneLayer) беруть проєкцію з core/projection.ts за цим виглядом.
import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';
import { FULL_VIEW, type View } from '../../core';

export interface ViewState { view: View; setView: Dispatch<SetStateAction<View>> }
export const ViewCtx = createContext<ViewState>({ view: FULL_VIEW, setView: () => {} });
export const useView = (): ViewState => useContext(ViewCtx);
