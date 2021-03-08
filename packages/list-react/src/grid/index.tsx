import React, { CSSProperties, memo, useCallback, useMemo } from "react"
import { isFakeItem } from "@rixio/list"
import { InfiniteLoader, InfiniteLoaderProps } from "react-virtualized/dist/es/InfiniteLoader"
import { Grid, GridCellRenderer, GridProps } from "react-virtualized/dist/es/Grid"
import { WindowScroller, WindowScrollerChildProps } from "react-virtualized/dist/es/WindowScroller"
import type { Index, IndexRange } from "react-virtualized"
import type { GridReactRenderer } from "../domain"
import { liftReactList, RxReactListProps } from "../rx"
import { identity } from "../utils"

export type GridRect = {
	rowHeight: number
	columnCount: number
	gap: number
	height: number
	width: number
}

export type GridListProps<T> = Partial<Pick<InfiniteLoaderProps,  "threshold">> & {
	renderer: GridReactRenderer<T>
	data: T[]
	minimumBatchRequest?: number
	rect: GridRect
	gridProps?: Partial<GridProps>
	pendingSize?: number
	loadNext: () => void
	mapKey?: (key: string) => string
}

export function GridList<T>(props: GridListProps<T>) {
	const { mapKey = identity, data, rect, minimumBatchRequest = 10, renderer, gridProps = {}, threshold = 3, loadNext } = props
	const rowCount = useMemo(() => Math.ceil(data.length / rect.columnCount), [data.length, rect.columnCount])
	const isRowLoaded = useCallback(
		({ index }: Index) => {
			const rowStart = rect.columnCount * index
			return rowStart < data.length && !isFakeItem(data[rowStart])
		},
		[data, rect.columnCount]
	)
	const loadMoreRows = useCallback<(params: IndexRange) => Promise<any>>(async () => loadNext(), [loadNext])
	const cellRenderer = useCallback<GridCellRenderer>(
		({ key, ...restCellProps }) => (
			<GridListCell
				gap={rect.gap}
				columnCount={rect.columnCount}
				rowCount={rowCount}
				renderer={renderer}
				data={data}
				key={mapKey(key)}
				{...restCellProps}
			/>
		),
		[data, mapKey, rect.columnCount, rect.gap, renderer, rowCount]
	)
	const containerStyle = {marginTop: `-${rect.gap / 2}px`};

	return (
		<InfiniteLoader
			threshold={threshold}
			isRowLoaded={isRowLoaded}
			rowCount={Infinity}
			loadMoreRows={loadMoreRows}
			minimumBatchSize={minimumBatchRequest}
		>
			{({ registerChild, onRowsRendered }) => (
				<Grid
					containerStyle={containerStyle}
					columnCount={rect.columnCount}
					columnWidth={rect.width / rect.columnCount}
					rowCount={rowCount}
					rowHeight={rect.rowHeight + rect.gap}
					cellRenderer={cellRenderer}
					height={rect.height}
					width={rect.width}
					{...gridProps}
					ref={registerChild}
					onSectionRendered={r =>
						onRowsRendered({
							startIndex: r.rowStartIndex,
							stopIndex: r.rowStopIndex,
						})
					}
				/>
			)}
		</InfiniteLoader>
	)
}

export type RxGridListProps<T> = RxReactListProps<T, GridListProps<T>>
export const RxGridList: <T>(props: RxGridListProps<T>) => JSX.Element = liftReactList(GridList) as any

export type GridWindowRect = Omit<GridRect, "height">
export type GridListWindowProps<T> = Omit<GridListProps<T>, "rect"> & {
	rect: GridWindowRect
}

export function GridListWindow<T>(props: GridListWindowProps<T>) {
	return <WindowScroller>{childProps => <GridListWindowChild {...childProps} {...props} />}</WindowScroller>
}
export type RxGridListWindowProps<T> = RxReactListProps<T, GridListWindowProps<T>>
export const RxGridListWindow: <T>(props: RxGridListWindowProps<T>) => JSX.Element = liftReactList(
	GridListWindow
) as any

type GridListWindowChildProps<T> = GridListWindowProps<T> &
	WindowScrollerChildProps & {
		height: number
	}
function GridListWindowChild<T>(props: GridListWindowChildProps<T>) {
	const { height, rect, isScrolling, scrollTop, onChildScroll, gridProps = {}, ...restProps } = props
	const finalRect = useMemo(() => ({ ...rect, height }), [height, rect])

	const finalGridProps = useMemo(
		() => ({
			...gridProps,
			autoHeight: true,
			isScrolling,
			scrollTop,
			onScroll: onChildScroll,
		}),
		[isScrolling, scrollTop, onChildScroll, gridProps]
	)

	return <GridList {...restProps} rect={finalRect} gridProps={finalGridProps} />
}

type GridListCellProps<T> = {
	rowIndex: number
	columnIndex: number
	style: CSSProperties
	columnCount: number
	renderer: GridReactRenderer<any>
	gap: number
	rowCount: number
	data: T[]
	isScrolling: boolean
}

const GridListCell = memo(function GridListCell<T>(props: GridListCellProps<T>) {
	const { renderer, rowIndex, columnCount, columnIndex, style, gap, data, rowCount, isScrolling } = props
	const index = rowIndex * columnCount + columnIndex
	const finalStyle = useMemo<CSSProperties>(
		() => ({
			position: "absolute",
			width: style.width,
			height: style.height,
			top: style.top,
			left: style.left,
			...getStylesWithGap(gap, rowIndex, columnIndex, rowCount, columnCount),
		}),
		[columnCount, columnIndex, gap, rowCount, rowIndex, style]
	)
	const item = data[index]
	const children = useMemo(() => renderer(item, isScrolling), [item, renderer, isScrolling])
	return <div style={finalStyle} children={children} />
})

const getStylesWithGap = (gap: number, row: number, col: number, rowCount: number, columnCount: number) => ({
	paddingLeft: col !== 0 ? gap / 2 : 0,
	paddingRight: col !== columnCount - 1 ? gap / 2 : 0,
	paddingTop: gap / 2,
	paddingBottom: gap / 2,
})
