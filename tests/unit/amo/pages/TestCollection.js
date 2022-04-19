import config from 'config';
import { createEvent, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createApiError } from 'amo/api';
import {
  ADDON_TYPE_STATIC_THEME,
  CLIENT_APP_FIREFOX,
  COLLECTION_SORT_DATE_ADDED_DESCENDING,
  COLLECTION_SORT_NAME,
} from 'amo/constants';
import {
  FETCH_CURRENT_COLLECTION,
  FETCH_CURRENT_COLLECTION_PAGE,
  collectionName,
  deleteCollection,
  deleteCollectionAddonNotes,
  fetchCurrentCollection,
  fetchCurrentCollectionPage,
  loadCurrentCollection,
  removeAddonFromCollection,
  updateCollectionAddon,
} from 'amo/reducers/collections';
import {
  SEND_SERVER_REDIRECT,
  sendServerRedirect,
} from 'amo/reducers/redirectTo';
import {
  DEFAULT_ADDON_PLACEHOLDER_COUNT,
  extractId,
} from 'amo/pages/Collection';
import {
  createFakeCollectionAddon,
  createFailedErrorHandler,
  createFakeCollectionDetail,
  createLocalizedString,
  createFakeCollectionAddonsListResponse,
  createHistory,
  dispatchClientMetadata,
  dispatchSignInActionsWithStore,
  fakeAddon,
  fakeI18n,
  fakePreview,
  getElement,
  onLocationChanged,
  renderPage as defaultRender,
  screen,
  within,
} from 'tests/unit/helpers';

describe(__filename, () => {
  let store;
  const clientApp = CLIENT_APP_FIREFOX;
  const defaultCollectionDescription = 'Collection description';
  const defaultCollectionId = 987;
  const defaultCollectionName = 'Collection name';
  const defaultCollectionSort = COLLECTION_SORT_DATE_ADDED_DESCENDING;
  const defaultPage = '1';
  const defaultFilters = {
    collectionSort: defaultCollectionSort,
    page: defaultPage,
  };
  const defaultSlug = 'default-collection-slug';
  const defaultUserId = 123;
  const editableCollectionAddonErrorHandlerId =
    'src/amo/components/EditableCollectionAddon/index.js-editable-collection-addon-1234';
  const lang = 'en-US';

  const getLocation = ({
    editing = false,
    slug = defaultSlug,
    userId = defaultUserId,
  } = {}) =>
    `/${lang}/${clientApp}/collections/${userId}/${slug}/${
      editing ? 'edit/' : ''
    }`;
  const defaultLocation = getLocation();

  const getCollectionPageErrorHandlerId = ({
    page = '',
    slug = defaultSlug,
    userId = defaultUserId,
  } = {}) => `src/amo/pages/Collection/index.js-${userId}/${slug}/${page}`;

  beforeEach(() => {
    store = dispatchClientMetadata({ clientApp, lang }).store;
  });

  const _createFakeCollectionDetail = (props = {}) => {
    return createFakeCollectionDetail({
      authorId: defaultUserId,
      description: defaultCollectionDescription,
      id: defaultCollectionId,
      name: defaultCollectionName,
      slug: defaultSlug,
      ...props,
    });
  };

  const render = ({
    editing = false,
    history,
    location,
    slug = defaultSlug,
    userId = defaultUserId,
  } = {}) => {
    const initialEntry = location || getLocation({ editing, slug, userId });

    const renderOptions = {
      history:
        history ||
        createHistory({
          initialEntries: [initialEntry],
        }),
      store,
    };
    return defaultRender(renderOptions);
  };

  const _loadCurrentCollection = ({
    addonsResponse = createFakeCollectionAddonsListResponse(),
    detail = _createFakeCollectionDetail(),
  } = {}) => {
    store.dispatch(
      loadCurrentCollection({
        addonsResponse,
        detail,
      }),
    );
  };

  const renderWithCollection = ({
    addons = [createFakeCollectionAddon({ addon: fakeAddon })],
    addonsResponse = createFakeCollectionAddonsListResponse({ addons }),
    detailProps = {},
    editing,
    history,
    location,
    slug,
    userId,
  } = {}) => {
    _loadCurrentCollection({
      addonsResponse,
      detail: {
        ..._createFakeCollectionDetail(detailProps),
        count: addons.length,
      },
    });

    return render({ editing, history, location, slug, userId });
  };

  const renderWithCollectionForSignedInUser = ({
    addons,
    addonsResponse,
    detailProps = {},
    editing,
    history,
    location,
    slug,
    userId = defaultUserId,
  } = {}) => {
    dispatchSignInActionsWithStore({ store, userId });
    return renderWithCollection({
      addons,
      addonsResponse,
      detailProps: { ...detailProps, authorId: userId },
      editing,
      history,
      location,
      slug,
      userId,
    });
  };

  const renderInAddMode = ({ history, loggedIn = true, withAddonId } = {}) => {
    if (loggedIn) {
      dispatchSignInActionsWithStore({ store, userId: defaultUserId });
    }
    return render({
      history:
        history ||
        createHistory({
          initialEntries: [
            `/${lang}/${clientApp}/collections/add/${
              withAddonId ? `?include_addon_id=${withAddonId}` : ''
            }`,
          ],
        }),
    });
  };

  const renderWithNotes = (notes = 'Some notes') => {
    renderWithCollectionForSignedInUser({
      addons: [
        createFakeCollectionAddon({
          notes,
        }),
      ],
      editing: true,
    });
  };

  const clickEditButton = () =>
    userEvent.click(screen.getByRole('link', { name: 'Edit this collection' }));

  const assertNoLoadingActionsDispatched = (dispatch) => {
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: FETCH_CURRENT_COLLECTION }),
    );
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: FETCH_CURRENT_COLLECTION_PAGE }),
    );
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: SEND_SERVER_REDIRECT }),
    );
    return true;
  };

  // Note: This test will be replaced by a test for CollectionDetailsCard
  // eslint-disable-next-line jest/no-commented-out-tests
  /*
  it('renders a CollectionDetailsCard', () => {
    const creating = false;
    const editing = false;
    const addonsResponse = createFakeCollectionAddonsListResponse();
    const detail = createFakeCollectionDetail();
    const collection = createInternalCollectionWithLang({
      detail,
      addonsResponse,
    });
    const page = 1;
    const sort = COLLECTION_SORT_NAME;
    const queryParams = { page, collection_sort: sort };
    const { store } = dispatchClientMetadata();

    _loadCurrentCollection({ addonsResponse, detail, store });

    const wrapper = renderComponent({
      creating,
      editing,
      location: createFakeLocation({ query: queryParams }),
      store,
    });

    const detailsCard = wrapper.find(CollectionDetailsCard);
    expect(detailsCard).toHaveProp('collection', collection);
    expect(detailsCard).toHaveProp('creating', creating);
    expect(detailsCard).toHaveProp('editing', editing);
    expect(detailsCard).toHaveProp('filters', { page, collectionSort: sort });
  });
  */

  it('renders placeholder text if there are no add-ons', () => {
    renderWithCollectionForSignedInUser({ addons: [] });

    expect(
      screen.getByText(
        'Search for extensions and themes to add to your collection.',
      ),
    ).toBeInTheDocument();
  });

  it('renders placeholder text when creating a collection', () => {
    renderInAddMode();

    expect(
      screen.getByText(
        'First, create your collection. Then you can add extensions and themes.',
      ),
    ).toBeInTheDocument();
  });

  it('hides placeholder text when creating a collection if not logged in', () => {
    renderInAddMode({ loggedIn: false });

    expect(
      screen.queryByText(
        'First, create your collection. Then you can add extensions and themes.',
      ),
    ).not.toBeInTheDocument();
  });

  it('hides placeholder text if there are add-ons', () => {
    renderWithCollectionForSignedInUser({
      addons: [createFakeCollectionAddon({ addon: fakeAddon })],
    });

    expect(
      screen.queryByText(
        'Search for extensions and themes to add to your collection.',
      ),
    ).not.toBeInTheDocument();
  });

  it('hides placeholder text when viewing a collection if the user is not logged in', () => {
    renderWithCollection({ addons: [] });

    expect(
      screen.queryByText(
        'Search for extensions and themes to add to your collection.',
      ),
    ).not.toBeInTheDocument();
  });

  it('dispatches fetchCurrentCollection on mount', () => {
    const dispatch = jest.spyOn(store, 'dispatch');
    render();

    expect(dispatch).toHaveBeenCalledWith(
      fetchCurrentCollection({
        errorHandlerId: getCollectionPageErrorHandlerId(),
        filters: defaultFilters,
        slug: defaultSlug,
        userId: defaultUserId,
      }),
    );
  });

  // // See: https://github.com/mozilla/addons-frontend/issues/7424
  it('dispatches fetchCurrentCollection on mount with a username in the URL', () => {
    const dispatch = jest.spyOn(store, 'dispatch');
    const userId = 'this-is-not-a-user-id';
    render({ userId });

    expect(dispatch).toHaveBeenCalledWith(
      fetchCurrentCollection({
        errorHandlerId: getCollectionPageErrorHandlerId({ userId }),
        filters: defaultFilters,
        slug: defaultSlug,
        userId,
      }),
    );
  });

  it('does not dispatch any loading actions when switching to edit mode', () => {
    const dispatch = jest.spyOn(store, 'dispatch');
    renderWithCollectionForSignedInUser();

    clickEditButton();

    expect(
      screen.getByRole('link', { name: 'Back to collection' }),
    ).toBeInTheDocument();
    expect(assertNoLoadingActionsDispatched(dispatch)).toBeTruthy();
  });

  it('does not dispatch any loading actions when creating a collection', () => {
    const dispatch = jest.spyOn(store, 'dispatch');
    renderInAddMode();

    expect(assertNoLoadingActionsDispatched(dispatch)).toBeTruthy();
  });

  it('passes filters from the query string to fetchCurrentCollection', () => {
    const page = '123';
    const sort = COLLECTION_SORT_NAME;
    const dispatch = jest.spyOn(store, 'dispatch');
    render({
      location: `${defaultLocation}?page=${page}&collection_sort=${sort}`,
    });

    expect(dispatch).toHaveBeenCalledWith(
      fetchCurrentCollection({
        errorHandlerId: getCollectionPageErrorHandlerId({ page }),
        filters: { page, collectionSort: sort },
        slug: defaultSlug,
        userId: defaultUserId,
      }),
    );
  });

  it('does not dispatch any loading actions when location has not changed', () => {
    const dispatch = jest.spyOn(store, 'dispatch');
    renderWithCollection();

    store.dispatch(
      onLocationChanged({
        pathname: defaultLocation,
      }),
    );

    expect(assertNoLoadingActionsDispatched(dispatch)).toBeTruthy();
  });

  it('does not dispatch any loading actions when a collection is loaded', () => {
    const dispatch = jest.spyOn(store, 'dispatch');
    renderWithCollection();

    expect(assertNoLoadingActionsDispatched(dispatch)).toBeTruthy();
  });

  it('does not dispatch any loading actions when a collection is loading', () => {
    store.dispatch(
      fetchCurrentCollection({
        errorHandlerId: getCollectionPageErrorHandlerId(),
        slug: defaultSlug,
        userId: defaultUserId,
      }),
    );
    const dispatch = jest.spyOn(store, 'dispatch');
    render();

    expect(assertNoLoadingActionsDispatched(dispatch)).toBeTruthy();
  });

  it('does not dispatch any loading actions when a collection page is loading', () => {
    store.dispatch(
      fetchCurrentCollectionPage({
        errorHandlerId: getCollectionPageErrorHandlerId(),
        slug: defaultSlug,
        userId: defaultUserId,
      }),
    );
    const dispatch = jest.spyOn(store, 'dispatch');
    render();

    expect(assertNoLoadingActionsDispatched(dispatch)).toBeTruthy();
  });

  it('does not dispatch any loading actions when there is an error', () => {
    createFailedErrorHandler({
      id: getCollectionPageErrorHandlerId(),
      store,
    });
    const dispatch = jest.spyOn(store, 'dispatch');
    render();

    expect(assertNoLoadingActionsDispatched(dispatch)).toBeTruthy();
  });

  it('dispatches fetchCurrentCollection when location pathname has changed', () => {
    const slug = `${defaultSlug}-new`;
    const dispatch = jest.spyOn(store, 'dispatch');
    renderWithCollection();

    store.dispatch(
      onLocationChanged({
        pathname: getLocation({ slug }),
      }),
    );

    expect(dispatch).toHaveBeenCalledWith(
      fetchCurrentCollection({
        errorHandlerId: getCollectionPageErrorHandlerId({ slug }),
        filters: defaultFilters,
        slug,
        userId: defaultUserId,
      }),
    );
  });

  it('dispatches fetchCurrentCollectionPage when page has changed', () => {
    const page = '2';
    const dispatch = jest.spyOn(store, 'dispatch');
    renderWithCollection({ location: `${defaultLocation}?page=1` });

    store.dispatch(
      onLocationChanged({
        pathname: `${defaultLocation}?page=${page}`,
      }),
    );

    expect(dispatch).toHaveBeenCalledWith(
      fetchCurrentCollectionPage({
        errorHandlerId: getCollectionPageErrorHandlerId({ page }),
        filters: { ...defaultFilters, page },
        slug: defaultSlug,
        userId: defaultUserId,
      }),
    );
  });

  it('dispatches fetchCurrentCollectionPage when sort has changed', () => {
    const sort = COLLECTION_SORT_NAME;
    const dispatch = jest.spyOn(store, 'dispatch');

    renderWithCollection();

    store.dispatch(
      onLocationChanged({
        pathname: `${defaultLocation}?collection_sort=${sort}`,
      }),
    );

    expect(dispatch).toHaveBeenCalledWith(
      fetchCurrentCollectionPage({
        errorHandlerId: getCollectionPageErrorHandlerId(),
        filters: { ...defaultFilters, collectionSort: sort },
        slug: defaultSlug,
        userId: defaultUserId,
      }),
    );
  });

  it('dispatches fetchCurrentCollection when user param has changed', () => {
    const userId = defaultUserId + 1;
    const dispatch = jest.spyOn(store, 'dispatch');

    renderWithCollection();

    store.dispatch(onLocationChanged({ pathname: getLocation({ userId }) }));

    expect(dispatch).toHaveBeenCalledWith(
      fetchCurrentCollection({
        errorHandlerId: getCollectionPageErrorHandlerId({ userId }),
        filters: defaultFilters,
        slug: defaultSlug,
        userId,
      }),
    );
  });

  it('dispatches fetchCurrentCollection when slug param has changed', () => {
    const slug = `${defaultSlug}-new`;
    const dispatch = jest.spyOn(store, 'dispatch');

    renderWithCollection();

    store.dispatch(onLocationChanged({ pathname: getLocation({ slug }) }));

    expect(dispatch).toHaveBeenCalledWith(
      fetchCurrentCollection({
        errorHandlerId: getCollectionPageErrorHandlerId({ slug }),
        filters: defaultFilters,
        slug,
        userId: defaultUserId,
      }),
    );
  });

  it('renders collection add-ons', () => {
    const addonName = 'My add-on';
    renderWithCollection({
      addons: [
        createFakeCollectionAddon({
          addon: {
            ...fakeAddon,
            name: createLocalizedString(addonName),
            type: ADDON_TYPE_STATIC_THEME,
          },
        }),
      ],
    });

    expect(screen.getByRole('link', { name: addonName })).toHaveAttribute(
      'href',
      `/${lang}/${clientApp}/addon/${fakeAddon.slug}/?utm_source=addons.mozilla.org&utm_medium=referral&utm_content=collection`,
    );
    expect(screen.getByAltText(addonName)).toHaveAttribute(
      'src',
      fakePreview.image_url,
    );
  });

  it('sets placeholder counts for the AddonsCard as expected', () => {
    render();

    // Each SearchResult will have 4 instances of LoadingText.
    expect(
      within(screen.getByClassName('AddonsCard')).getAllByRole('alert'),
    ).toHaveLength(DEFAULT_ADDON_PLACEHOLDER_COUNT * 4);

    _loadCurrentCollection({
      addonsResponse: createFakeCollectionAddonsListResponse({
        addons: [
          createFakeCollectionAddon({
            addon: fakeAddon,
          }),
        ],
      }),
    });

    // After loading no loading indicators will be present.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Switch to a different slug, which will initiate a new loading state.
    store.dispatch(
      onLocationChanged({
        pathname: getLocation({ slug: `${defaultSlug}-new` }),
      }),
    );

    // Only expect one loading SearchResult as that matches the number of
    // add-ons in the previously loaded collection.
    expect(
      within(screen.getByClassName('AddonsCard')).getAllByRole('alert'),
    ).toHaveLength(4);
  });

  it('renders a collection with pagination', () => {
    const sort = COLLECTION_SORT_NAME;
    // With a pageSize < count, the pagination will be displayed.
    const addonsResponse = createFakeCollectionAddonsListResponse({
      count: 10,
      pageSize: 5,
    });
    _loadCurrentCollection({ addonsResponse });

    render({
      location: `${getLocation()}?collection_sort=${sort}&page=2`,
    });

    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute(
      'href',
      `${defaultLocation}?page=1&collection_sort=${sort}`,
    );
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('renders a create collection page', () => {
    renderInAddMode();

    const expectedUrlPrefix = `${config.get(
      'apiHost',
    )}/${lang}/${clientApp}/collections/${defaultUserId}/`;
    expect(
      screen.getByRole('textbox', { name: 'Collection name' }),
    ).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue(
      '',
    );
    expect(screen.getByRole('textbox', { name: 'Custom URL' })).toHaveValue('');
    expect(screen.getByTitle(expectedUrlPrefix)).toHaveTextContent(
      expectedUrlPrefix,
    );
    expect(
      screen.getByRole('button', { name: 'Create collection' }),
    ).toHaveProperty('disabled', true);

    // Sort controls should be absent.
    expect(
      screen.queryByRole('combobox', { name: 'Sort add-ons by' }),
    ).not.toBeInTheDocument();

    // Collection add-ons should be absent.
    expect(screen.queryByClassName('AddonsCard')).not.toBeInTheDocument();
  });

  it('does not render the pagination when no add-ons in the collection', () => {
    renderWithCollection({ addons: [] });

    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  it('renders loading indicator on add-ons when fetching next page', () => {
    const name = 'My Collection';
    const numberOfAddons = 5;
    const addonsResponse = createFakeCollectionAddonsListResponse({
      count: 10,
      pageSize: numberOfAddons,
    });
    _loadCurrentCollection({
      addonsResponse,
      detail: _createFakeCollectionDetail({ name }),
    });

    render({
      location: `${getLocation()}?page=1`,
    });

    userEvent.click(screen.getByRole('link', { name: 'Next' }));

    // Expect loading indicators for the add-ons.
    expect(
      within(screen.getByClassName('AddonsCard')).getAllByRole('alert'),
    ).toHaveLength(numberOfAddons * 4);
    // Expect to retain the details of the collection.
    expect(screen.getByRole('heading', { name })).toBeInTheDocument();
  });

  it('renders 404 page for missing collection', () => {
    createFailedErrorHandler({
      error: createApiError({
        response: { status: 404 },
      }),
      id: getCollectionPageErrorHandlerId(),
      store,
    });

    render();

    expect(
      screen.getByText('Oops! We can’t find that page'),
    ).toBeInTheDocument();
  });

  it('renders an error if one exists', () => {
    const message = 'Some error message';
    createFailedErrorHandler({
      id: getCollectionPageErrorHandlerId(),
      message,
      store,
    });

    render();

    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('renders an HTML title', async () => {
    renderWithCollection();

    await waitFor(() => expect(getElement('title')).toBeInTheDocument());

    expect(getElement('title')).toHaveTextContent(
      `${defaultCollectionName} – Add-ons for Firefox (en-US)`,
    );
  });

  it('renders an HTML title for a collection with a missing name', async () => {
    renderWithCollection({ detailProps: { name: null } });

    await waitFor(() => expect(getElement('title')).toBeInTheDocument());

    expect(getElement('title')).toHaveTextContent(
      `${collectionName({
        name: null,
        i18n: fakeI18n(),
      })} – Add-ons for Firefox (en-US)`,
    );
  });

  it('renders the default HTML title when there is no collection loaded', async () => {
    render();

    await waitFor(() => expect(getElement('title')).toBeInTheDocument());

    expect(getElement('title')).toHaveTextContent(
      'Add-ons for Firefox (en-US)',
    );
  });

  it('renders a delete button when user is the collection owner', () => {
    renderWithCollectionForSignedInUser();

    expect(
      screen.getByRole('button', { name: 'Delete this collection' }),
    ).toBeInTheDocument();
  });

  it('does not render a delete button when user is not the collection owner', () => {
    dispatchSignInActionsWithStore({ store, userId: defaultUserId + 1 });
    renderWithCollection();

    expect(
      screen.queryByRole('button', { name: 'Delete this collection' }),
    ).not.toBeInTheDocument();
  });

  it('renders a CollectionAddAddon component when editing', () => {
    renderWithCollectionForSignedInUser({ editing: true });

    expect(
      screen.getByPlaceholderText(
        'Find an add-on to include in this collection',
      ),
    ).toBeInTheDocument();
  });

  it('does not render a CollectionAddAddon component when not editing', () => {
    renderWithCollectionForSignedInUser();

    expect(
      screen.queryByPlaceholderText(
        'Find an add-on to include in this collection',
      ),
    ).not.toBeInTheDocument();
  });

  it('renders AuthenticateButton when creating and not signed in', () => {
    renderInAddMode({ loggedIn: false });

    expect(
      screen.getByRole('link', { name: 'Log in to create a collection' }),
    ).toBeInTheDocument();

    // Make sure the form was not rendered.
    expect(
      screen.queryByRole('textbox', { name: 'Collection name' }),
    ).not.toBeInTheDocument();
  });

  it('renders AuthenticateButton when editing and not signed in', () => {
    renderWithCollection({ editing: true });

    expect(
      screen.getByRole('link', { name: 'Log in to edit this collection' }),
    ).toBeInTheDocument();

    // Make sure the form was not rendered.
    expect(
      screen.queryByRole('textbox', { name: 'Collection name' }),
    ).not.toBeInTheDocument();
  });

  it('does not update the page when removeAddon is called and there are still addons to show on the current page', () => {
    const numberOfAddons = 5;
    const addonsResponse = createFakeCollectionAddonsListResponse({
      count: 10,
      pageSize: numberOfAddons,
    });
    const addonId = addonsResponse.results[0].addon.id;
    const page = '2';
    const history = createHistory({
      initialEntries: [`${defaultLocation}edit/?page=${page}`],
    });
    const pushSpy = jest.spyOn(history, 'push');
    const dispatch = jest.spyOn(store, 'dispatch');

    renderWithCollectionForSignedInUser({
      addonsResponse,
      history,
    });

    userEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);

    expect(dispatch).toHaveBeenCalledWith(
      removeAddonFromCollection({
        addonId,
        errorHandlerId: getCollectionPageErrorHandlerId({ page }),
        filters: { ...defaultFilters, page },
        slug: defaultSlug,
        userId: defaultUserId,
      }),
    );
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it("does not update the page when removeAddon is called and the current page isn't the last page", () => {
    const numberOfAddons = 5;
    const addonsResponse = createFakeCollectionAddonsListResponse({
      count: 10,
      pageSize: numberOfAddons,
    });
    const addonId = addonsResponse.results[0].addon.id;
    const page = '1';
    const history = createHistory({
      initialEntries: [`${defaultLocation}edit/?page=${page}`],
    });
    const pushSpy = jest.spyOn(history, 'push');
    const dispatch = jest.spyOn(store, 'dispatch');

    renderWithCollectionForSignedInUser({
      addonsResponse,
      history,
    });

    userEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);

    expect(dispatch).toHaveBeenCalledWith(
      removeAddonFromCollection({
        addonId,
        errorHandlerId: getCollectionPageErrorHandlerId({ page }),
        filters: { ...defaultFilters, page },
        slug: defaultSlug,
        userId: defaultUserId,
      }),
    );
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('updates the page when removeAddon removes the last addon from the current page', () => {
    const numberOfAddons = 1;
    const addonsResponse = createFakeCollectionAddonsListResponse({
      count: 2,
      pageSize: numberOfAddons,
    });
    const addonId = addonsResponse.results[0].addon.id;
    const page = '2';
    const sort = COLLECTION_SORT_DATE_ADDED_DESCENDING;
    const history = createHistory({
      initialEntries: [
        `${defaultLocation}edit/?page=${page}&collection_sort=${sort}`,
      ],
    });
    const pushSpy = jest.spyOn(history, 'push');
    const dispatch = jest.spyOn(store, 'dispatch');

    renderWithCollectionForSignedInUser({ addonsResponse, history });

    userEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);

    expect(dispatch).toHaveBeenCalledWith(
      removeAddonFromCollection({
        addonId,
        errorHandlerId: getCollectionPageErrorHandlerId({ page }),
        filters: { ...defaultFilters, page: '1' },
        slug: defaultSlug,
        userId: defaultUserId,
      }),
    );
    expect(pushSpy).toHaveBeenCalledWith({
      pathname: `${defaultLocation}edit/`,
      query: {
        collection_sort: sort,
        page: '1',
      },
    });
  });

  it('dispatches deleteCollection when the Delete collection button is clicked and confirmed', () => {
    const dispatch = jest.spyOn(store, 'dispatch');
    renderWithCollectionForSignedInUser();

    const button = screen.getByRole('button', {
      name: 'Delete this collection',
    });
    const clickEvent = createEvent.click(button);
    const preventDefaultWatcher = jest.spyOn(clickEvent, 'preventDefault');
    fireEvent(button, clickEvent);

    userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(preventDefaultWatcher).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      deleteCollection({
        errorHandlerId: getCollectionPageErrorHandlerId(),
        slug: defaultSlug,
        userId: defaultUserId,
      }),
    );
  });

  it('dispatches deleteCollectionAddonNotes when clicking delete on DismissibleTextForm', () => {
    const dispatch = jest.spyOn(store, 'dispatch');
    renderWithNotes();

    userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(dispatch).toHaveBeenCalledWith(
      deleteCollectionAddonNotes({
        addonId: fakeAddon.id,
        errorHandlerId: editableCollectionAddonErrorHandlerId,
        filters: defaultFilters,
        lang,
        slug: defaultSlug,
        userId: defaultUserId,
      }),
    );
  });

  it('dispatches updateCollectionAddon when saving DismissibleTextForm', () => {
    const newNotes = 'Some new notes';
    const dispatch = jest.spyOn(store, 'dispatch');
    renderWithNotes();

    userEvent.click(screen.getByRole('button', { name: 'Edit' }));

    userEvent.type(
      screen.getByPlaceholderText('Add a comment about this add-on.'),
      `{selectall}{del}${newNotes}`,
    );

    userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(dispatch).toHaveBeenCalledWith(
      updateCollectionAddon({
        addonId: fakeAddon.id,
        errorHandlerId: editableCollectionAddonErrorHandlerId,
        filters: defaultFilters,
        notes: createLocalizedString(newNotes, lang),
        slug: defaultSlug,
        userId: defaultUserId,
      }),
    );
  });

  it('sends a server redirect when userId parameter is not a numeric ID', () => {
    const authorId = 19;
    const authorUsername = 'john';
    const dispatch = jest.spyOn(store, 'dispatch');

    _loadCurrentCollection({
      detail: _createFakeCollectionDetail({
        authorId,
        authorUsername,
      }),
    });

    render({ userId: authorUsername });

    expect(dispatch).toHaveBeenCalledWith(
      sendServerRedirect({
        status: 301,
        url: `/${lang}/${clientApp}/collections/${authorId}/${defaultSlug}/`,
      }),
    );
  });

  it('sends a server redirect when slug parameter case is not the same as the collection slug', () => {
    const dispatch = jest.spyOn(store, 'dispatch');

    _loadCurrentCollection();

    render({ slug: defaultSlug.toUpperCase() });

    expect(dispatch).toHaveBeenCalledWith(
      sendServerRedirect({
        status: 301,
        url: `/${lang}/${clientApp}/collections/${defaultUserId}/${defaultSlug}/`,
      }),
    );
  });

  it('renders a "description" meta tag', async () => {
    const name = 'my super collection';
    const description = 'this is the description of my super collection';
    renderWithCollection({ detailProps: { name, description } });

    await waitFor(() =>
      expect(getElement('meta[name="description"]')).toBeInTheDocument(),
    );

    expect(getElement('meta[name="description"]')).toHaveAttribute(
      'content',
      [
        'Download and create Firefox collections to keep track of favorite extensions and themes.',
        `Explore the ${name}—${description}.`,
      ].join(' '),
    );
  });

  it('renders a "description" meta tag without a collection description', async () => {
    const name = 'my super collection';
    const description = '';
    renderWithCollection({ detailProps: { name, description } });

    await waitFor(() =>
      expect(getElement('meta[name="description"]')).toBeInTheDocument(),
    );

    expect(getElement('meta[name="description"]')).toHaveAttribute(
      'content',
      [
        'Download and create Firefox collections to keep track of favorite extensions and themes.',
        `Explore the ${name}.`,
      ].join(' '),
    );
  });

  it('renders a "description" meta tag for a collection with a missing name', async () => {
    const name = null;
    const description = '';

    renderWithCollection({ detailProps: { name, description } });

    await waitFor(() =>
      expect(getElement('meta[name="description"]')).toBeInTheDocument(),
    );

    expect(getElement('meta[name="description"]')).toHaveAttribute(
      'content',
      [
        'Download and create Firefox collections to keep track of favorite extensions and themes.',
        `Explore the ${collectionName({
          name,
          i18n: fakeI18n(),
        })}.`,
      ].join(' '),
    );
  });

  describe('errorHandler - extractId', () => {
    it('returns a unique ID based on params', () => {
      const props = {
        match: {
          params: {
            userId: '123',
            slug: 'collection-bar',
          },
        },
        location: { query: {} },
      };

      expect(extractId(props)).toEqual('123/collection-bar/');
    });

    it('adds the page as part of unique ID', () => {
      const props = {
        match: {
          params: {
            userId: '123',
            slug: 'collection-bar',
          },
        },
        location: { query: { page: '124' } },
      };

      expect(extractId(props)).toEqual('123/collection-bar/124');
    });
  });
});
