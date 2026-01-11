import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import AuditoriaView from '../AuditoriaView.vue'
import api from '@/api/axios'

vi.mock('@/api/axios')
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

describe('AuditoriaView - Pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createMockApiResponse = (totalPages: number, currentPage: number = 1) => ({
    data: {
      success: true,
      data: [],
      pagination: {
        total_records: totalPages * 15,
        current_page: currentPage,
        total_pages: totalPages,
        limit_applied: 15,
      },
    },
  })

  it('shows all pages when there are 7 or fewer pages', async () => {
    vi.mocked(api.get).mockResolvedValue(createMockApiResponse(5))

    const wrapper = mount(AuditoriaView)
    await nextTick()

    // Wait for the component to load data
    await new Promise(resolve => setTimeout(resolve, 100))
    await nextTick()

    const pageButtons = wrapper.findAll('.page-item button')
    const pageNumbers = pageButtons
      .filter(btn => !btn.text().includes('Anterior') && !btn.text().includes('Siguiente'))
      .map(btn => btn.text())

    expect(pageNumbers).toEqual(['1', '2', '3', '4', '5'])
  })

  it('shows ellipsis and limited pages when there are many pages (current page near start)', async () => {
    vi.mocked(api.get).mockResolvedValue(createMockApiResponse(100, 2))

    const wrapper = mount(AuditoriaView)
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))
    await nextTick()

    const pageButtons = wrapper.findAll('.page-item button')
    const pageNumbers = pageButtons
      .filter(btn => !btn.text().includes('Anterior') && !btn.text().includes('Siguiente'))
      .map(btn => btn.text())

    // Should show: 1, 2, 3, 4, ..., 100
    expect(pageNumbers).toContain('1')
    expect(pageNumbers).toContain('2')
    expect(pageNumbers).toContain('3')
    expect(pageNumbers).toContain('4')
    expect(pageNumbers).toContain('...')
    expect(pageNumbers).toContain('100')
    expect(pageNumbers.length).toBeLessThan(10) // Much less than 100
  })

  it('shows ellipsis and limited pages when there are many pages (current page in middle)', async () => {
    vi.mocked(api.get).mockResolvedValue(createMockApiResponse(100, 50))

    const wrapper = mount(AuditoriaView)
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))
    await nextTick()

    const pageButtons = wrapper.findAll('.page-item button')
    const pageNumbers = pageButtons
      .filter(btn => !btn.text().includes('Anterior') && !btn.text().includes('Siguiente'))
      .map(btn => btn.text())

    // Should show: 1, ..., 49, 50, 51, ..., 100
    expect(pageNumbers).toContain('1')
    expect(pageNumbers).toContain('49')
    expect(pageNumbers).toContain('50')
    expect(pageNumbers).toContain('51')
    expect(pageNumbers).toContain('100')
    expect(pageNumbers.filter(num => num === '...')).toHaveLength(2) // Two ellipsis
    expect(pageNumbers.length).toBeLessThan(10) // Much less than 100
  })

  it('shows ellipsis and limited pages when there are many pages (current page near end)', async () => {
    vi.mocked(api.get).mockResolvedValue(createMockApiResponse(100, 99))

    const wrapper = mount(AuditoriaView)
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))
    await nextTick()

    const pageButtons = wrapper.findAll('.page-item button')
    const pageNumbers = pageButtons
      .filter(btn => !btn.text().includes('Anterior') && !btn.text().includes('Siguiente'))
      .map(btn => btn.text())

    // Should show: 1, ..., 97, 98, 99, 100
    expect(pageNumbers).toContain('1')
    expect(pageNumbers).toContain('...')
    expect(pageNumbers).toContain('97')
    expect(pageNumbers).toContain('98')
    expect(pageNumbers).toContain('99')
    expect(pageNumbers).toContain('100')
    expect(pageNumbers.length).toBeLessThan(10) // Much less than 100
  })

  it('ellipsis buttons are disabled', async () => {
    vi.mocked(api.get).mockResolvedValue(createMockApiResponse(100, 50))

    const wrapper = mount(AuditoriaView)
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))
    await nextTick()

    const ellipsisButtons = wrapper.findAll('.page-item.disabled button').filter(btn => 
      btn.text() === '...'
    )
    
    ellipsisButtons.forEach(button => {
      expect(button.attributes('disabled')).toBeDefined()
    })
  })

  it('does not create buttons for all pages when total pages is large', async () => {
    vi.mocked(api.get).mockResolvedValue(createMockApiResponse(1000, 500))

    const wrapper = mount(AuditoriaView)
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))
    await nextTick()

    const pageButtons = wrapper.findAll('.page-item button')
    const pageNumbers = pageButtons
      .filter(btn => !btn.text().includes('Anterior') && !btn.text().includes('Siguiente'))

    // Should have significantly fewer buttons than 1000
    expect(pageNumbers.length).toBeLessThan(20)
  })
})
